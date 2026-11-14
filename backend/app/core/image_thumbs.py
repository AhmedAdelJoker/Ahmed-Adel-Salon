"""Thumbnail serving for `/uploads` images.

The public site requests small variants of salon media (`?w=160` on a service
thumb). Starlette's StaticFiles ignores the query string entirely, so the
parameter was decorative: every 48px thumb downloaded the full 1920px original.

This middleware intercepts only `GET /uploads/{public_subdir}/…` requests that
carry an integer `w`, produces (and caches on disk) a downscaled copy, and
returns it. Every other request — no `w`, non-image, unknown subdir, or a path
that escapes the uploads root — falls through to the mounted StaticFiles, so
the normal (and hardened) behaviour is untouched.

Thumbs live under `uploads_root/.thumbs/` which is not one of the mounted
public subdirectories, so they are never directly reachable.
"""

import os
import re
import tempfile
from pathlib import Path

from fastapi.responses import FileResponse

from PIL import Image

# Mirrors the public subdirectories mounted in app.main — a subdir that is not
# publicly mounted cannot be resized through here either.
PUBLIC_UPLOAD_SUBDIRS = frozenset(
    {"business", "products", "services", "employees", "profiles", "offers"}
)

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

_WIDTH_RE = re.compile(r"^\d{1,4}$")
MIN_WIDTH = 16
MAX_WIDTH = 2000


def _resolve_source(uploads_root: Path, rel_path: str) -> Path | None:
    """The real file behind `/{subdir}/{name}.{ext}` — None for anything else.

    Traversal is the threat here: the middleware runs before routing, so it
    cannot borrow StaticFiles' own protections. Resolve the candidate and keep
    it only if it stays inside the uploads root, sits in a public subdir, and
    carries a known image extension.
    """
    if not rel_path or "\\" in rel_path or ".." in rel_path:
        return None
    parts = rel_path.split("/")
    if len(parts) != 2 or parts[0] not in PUBLIC_UPLOAD_SUBDIRS:
        return None
    suffix = Path(parts[1]).suffix.lower()
    if suffix not in CONTENT_TYPES:
        return None
    try:
        candidate = (uploads_root / rel_path).resolve()
        candidate.relative_to(uploads_root.resolve())
    except (OSError, ValueError):
        return None
    if not candidate.is_file():
        return None
    return candidate


def _thumb_dest(uploads_root: Path, source: Path, width: int) -> Path:
    rel = source.relative_to(uploads_root.resolve())
    cache_name = "__".join(rel.parts) + f"__w{width}{source.suffix.lower()}"
    return uploads_root / ".thumbs" / cache_name


def build_thumb(source: Path, dest: Path, width: int) -> bool:
    """Write the downscaled copy; False when the source is smaller (no upscale)."""
    with Image.open(source) as im:
        if im.width <= width:
            return False
        height = max(1, round(im.height * width / im.width))
        resized = im.resize((width, height), Image.LANCZOS)
        if dest.suffix.lower() in (".jpg", ".jpeg"):
            resized = resized.convert("RGB")
        dest.parent.mkdir(parents=True, exist_ok=True)
        # Atomic publish: a concurrent request must never read a half-written
        # file. Unique temp then os.replace.
        tmp_fd, tmp_name = tempfile.mkstemp(
            dir=str(dest.parent), suffix=dest.suffix
        )
        os.close(tmp_fd)
        try:
            save_kwargs = (
                {"quality": 82, "optimize": True}
                if dest.suffix.lower() in (".jpg", ".jpeg")
                else {}
            )
            resized.save(tmp_name, **save_kwargs)
            os.replace(tmp_name, dest)
        finally:
            if os.path.exists(tmp_name):
                try:
                    os.remove(tmp_name)
                except OSError:
                    pass
        return True


async def maybe_resized_upload(request, call_next, uploads_root: Path):
    """ASGI http middleware: serve `?w=` thumbs, delegate everything else."""
    query = request.query_params.get("w")
    if request.method != "GET" or query is None:
        return await call_next(request)

    if not _WIDTH_RE.fullmatch(query):
        return await call_next(request)
    width = int(query)
    if width < MIN_WIDTH:
        return await call_next(request)
    width = min(width, MAX_WIDTH)

    path = request.url.path
    if not path.startswith("/uploads/"):
        return await call_next(request)

    source = _resolve_source(uploads_root, path[len("/uploads/"):])
    if source is None:
        # Delegating keeps every error code StaticFiles would have produced.
        return await call_next(request)

    dest = _thumb_dest(uploads_root, source, width)
    try:
        source_mtime = source.stat().st_mtime
        stale = not dest.is_file() or dest.stat().st_mtime + 1e-3 < source_mtime
        if stale:
            if not build_thumb(source, dest, width):
                dest = source  # original is smaller than the ask
    except Exception:
        # A thumb failure must never take a working image away: fall back to
        # the original file through the normal static pipeline.
        return await call_next(request)

    media_type = CONTENT_TYPES[dest.suffix.lower()]
    etag = f'W/"{dest.stat().st_size:x}-{int(dest.stat().st_mtime):x}-{width}"'
    if request.headers.get("if-none-match") == etag:
        from fastapi.responses import Response

        return Response(status_code=304, headers={"ETag": etag})
    return FileResponse(
        dest,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "ETag": etag,
        },
    )
