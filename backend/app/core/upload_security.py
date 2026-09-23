"""
Upload Security — phase 3 hardening.

Provides reusable defenses for every file-upload endpoint:

  1. Size limit (configurable, default 10 MB)
  2. Extension allowlist (configurable via settings.ALLOWED_UPLOAD_EXTENSIONS)
  3. MIME sniffing via libmagic / Pillow — never trusts the client-provided type
  4. Filename sanitization — strip directory traversal, dangerous chars,
     and embedded NUL bytes
  5. Path containment check — reject any filename that escapes the upload dir
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.core.paths import get_uploads_dir as _get_uploads_dir  # SOT delegation for §5.2


# Filename pattern: letters, digits, dashes, underscores, dots, spaces, and
# Arabic characters. Anything else is replaced with underscore.
_SAFE_FILENAME_RE = re.compile(r"[^\w\-\. ]", re.UNICODE)
# Reserved Windows device names
_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def _allowed_extensions() -> set[str]:
    raw = settings.ALLOWED_UPLOAD_EXTENSIONS
    return {f".{ext.strip().lower().lstrip('.')}" for ext in raw.split(",")}


def sanitize_filename(raw: str, *, fallback: str = "upload") -> str:
    """Return a filename safe to write to disk.

    Strips directory traversal, dangerous chars, and reserved Windows names.
    Caps the length at 100 chars to avoid filesystem limits.
    """
    if not raw:
        return f"{fallback}.bin"

    # 1. Strip directory components — basename only
    name = Path(raw).name
    # 2. Reject empty / dot-only names
    if not name or name in {".", ".."}:
        name = f"{fallback}.bin"
    # 3. Normalize Unicode (e.g., e + combining acute -> é)
    name = unicodedata.normalize("NFKC", name)
    # 4. Replace unsafe chars with underscore
    name = _SAFE_FILENAME_RE.sub("_", name)
    # 5. Strip leading dots — prevents hidden files on POSIX
    while name.startswith("."):
        name = name[1:] or f"{fallback}.bin"
    # 6. Reject reserved Windows names (case-insensitive, sans extension)
    stem = Path(name).stem.upper()
    if stem in _RESERVED_NAMES:
        name = f"_{name}"
    # 7. Cap length
    if len(name) > 100:
        suffix = Path(name).suffix
        stem_only = Path(name).stem[: 100 - len(suffix)]
        name = f"{stem_only}{suffix}"
    return name


def assert_safe_destination(upload_root: Path, target: Path) -> None:
    """Reject any target that escapes upload_root (defense-in-depth)."""
    try:
        target_resolved = target.resolve(strict=False)
        root_resolved = upload_root.resolve(strict=False)
    except (OSError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="اسم الملف غير صالح",
        ) from exc

    if target_resolved != root_resolved and root_resolved not in target_resolved.parents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="اسم الملف يحاول الخروج من مجلد الرفع",
        )


def _sniff_mime(content: bytes) -> str | None:
    """Lightweight magic-byte MIME sniffing. No external dependency."""
    if not content:
        return None
    head = content[:16]
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return "image/gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[:5] == b"%PDF-":
        return "application/pdf"
    # xlsx / docx / zip-based formats all start with PK\x03\x04
    if head[:4] == b"PK\x03\x04":
        return "application/zip"
    # Plain text / CSV heuristic
    try:
        head.decode("utf-8")
        if "," in head.decode("utf-8", errors="ignore").splitlines()[0]:
            return "text/csv"
    except (UnicodeDecodeError, IndexError):
        pass
    return None


# Map allowed extensions → acceptable sniffed MIME types
_EXT_TO_MIMES: dict[str, set[str]] = {
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".webp": {"image/webp"},
    ".gif": {"image/gif"},
    ".pdf": {"application/pdf"},
    ".xlsx": {"application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
    ".csv": {"text/csv", "text/plain"},
}


async def validate_upload(
    upload: UploadFile,
    *,
    max_size: int | None = None,
) -> bytes:
    """Validate an UploadFile and return its bytes.

    Raises HTTPException(400) on any violation.
    """
    # 1. Filename sanity
    safe_name = sanitize_filename(upload.filename or "")

    # 2. Extension check
    ext = Path(safe_name).suffix.lower()
    if ext not in _allowed_extensions():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"نوع الملف {ext or '(لا يوجد امتداد)'} غير مسموح. "
                   f"الأنواع المسموحة: {', '.join(sorted(_allowed_extensions()))}",
        )

    # 3. Read + size limit
    limit = max_size if max_size is not None else settings.MAX_UPLOAD_SIZE_BYTES
    content = await upload.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="الملف فارغ",
        )
    if len(content) > limit:
        mb_limit = limit // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"حجم الملف يتجاوز الحد المسموح ({mb_limit} ميجابايت)",
        )

    # 4. MIME sniff — does the actual content match the extension?
    sniffed = _sniff_mime(content)
    expected_mimes = _EXT_TO_MIMES.get(ext)
    if expected_mimes is not None:
        if sniffed is None or sniffed not in expected_mimes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="محتوى الملف لا يتطابق مع الامتداد المعلن — قد يكون ملفاً ضاراً",
            )

    # 5. Override upload.filename with the sanitized version so downstream
    #    code can rely on it.
    upload.filename = safe_name
    return content


# =============================================================================
# Per-purpose upload presets — use these from endpoints instead of calling
# validate_upload() with bespoke arguments.
# =============================================================================

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_PDF_EXTS = {".pdf"}
_DATA_EXTS = {".xlsx", ".csv"}
_IMAGE_OR_PDF_EXTS = _IMAGE_EXTS | _PDF_EXTS


def _only(exts: set[str]):
    """Return a context manager that temporarily restricts the allowed list."""
    import contextlib

    @contextlib.contextmanager
    def _ctx():
        original = settings.ALLOWED_UPLOAD_EXTENSIONS
        # We mutate the field via the underlying value, not via .set (pydantic)
        object.__setattr__(
            settings, "ALLOWED_UPLOAD_EXTENSIONS", ",".join(e.lstrip(".") for e in exts)
        )
        try:
            yield
        finally:
            object.__setattr__(settings, "ALLOWED_UPLOAD_EXTENSIONS", original)

    return _ctx()


async def validate_image(upload: UploadFile, *, max_size: int | None = None) -> bytes:
    """Validate an image upload (jpg, jpeg, png, webp, gif)."""
    with _only(_IMAGE_EXTS):
        return await validate_upload(upload, max_size=max_size)


async def validate_pdf(upload: UploadFile, *, max_size: int | None = None) -> bytes:
    """Validate a PDF upload."""
    with _only(_PDF_EXTS):
        return await validate_upload(upload, max_size=max_size)


async def validate_image_or_pdf(
    upload: UploadFile, *, max_size: int | None = None
) -> bytes:
    """Validate an image or PDF (used for invoices, documents)."""
    with _only(_IMAGE_OR_PDF_EXTS):
        return await validate_upload(upload, max_size=max_size)


async def validate_data_sheet(
    upload: UploadFile, *, max_size: int | None = None
) -> bytes:
    """Validate an Excel/CSV data import."""
    with _only(_DATA_EXTS):
        return await validate_upload(upload, max_size=max_size)


def get_upload_root() -> Path:
    """Canonical uploads root — delegates to app.core.paths (single source of truth)."""
    return _get_uploads_dir()


def get_upload_path(folder: str) -> Path:
    """Convenience: uploads subfolder via central paths helper."""
    return _get_uploads_dir() / folder
