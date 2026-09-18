"""Phase 3.5 — verify validate_upload presets across endpoints.

Uses asyncio.run() instead of pytest-asyncio to avoid an extra dependency.
"""
import asyncio
import io

from fastapi import HTTPException, UploadFile

from app.core.upload_security import (
    sanitize_filename,
    validate_data_sheet,
    validate_image,
    validate_image_or_pdf,
    validate_pdf,
)


def _upload(content: bytes, name: str) -> UploadFile:
    """Build an UploadFile from raw bytes — bypasses SpooledTemporaryFile."""
    return UploadFile(filename=name, file=io.BytesIO(content))


def _run(coro):
    """Helper: run a coroutine in a fresh loop."""
    return asyncio.run(coro)


# ============================================================
# Sanitization
# ============================================================
def test_sanitize_strips_traversal():
    assert "/" not in sanitize_filename("subdir/file.png")
    assert "\\" not in sanitize_filename("subdir\\file.png")
    assert ".." not in sanitize_filename("../etc/passwd")


def test_sanitize_handles_reserved_names():
    # Windows reserved names must be prefixed with underscore
    assert sanitize_filename("CON.png").startswith("_")
    assert sanitize_filename("PRN.txt").startswith("_")


def test_sanitize_caps_length():
    long = "a" * 200 + ".jpg"
    sanitized = sanitize_filename(long)
    assert len(sanitized) <= 100
    assert sanitized.endswith(".jpg")


def test_sanitize_preserves_unicode():
    assert sanitize_filename("اسم العميل.pdf").endswith(".pdf")
    assert sanitize_filename("café.jpg").endswith(".jpg")


# ============================================================
# Image validation
# ============================================================
def test_validate_image_rejects_mislabeled_file():
    """A file with a .jpg extension but PDF content must be rejected."""
    fake_jpg = b"%PDF-1.4\n%fake pdf body..."  # actual PDF magic bytes
    upload = _upload(fake_jpg, "invoice.jpg")
    with __pytest_raises_HTTPError(400):
        _run(validate_image(upload))


def test_validate_image_rejects_oversize():
    upload = _upload(b"\xff\xd8\xff\xe0" + b"x" * (6 * 1024 * 1024), "big.jpg")
    with __pytest_raises_HTTPError(413):
        _run(validate_image(upload, max_size=5 * 1024 * 1024))


def test_validate_image_rejects_empty():
    upload = _upload(b"", "empty.jpg")
    with __pytest_raises_HTTPError(400):
        _run(validate_image(upload))


def test_validate_image_rejects_disallowed_extension():
    upload = _upload(b"\xff\xd8\xff\xe0abc", "photo.bmp")
    with __pytest_raises_HTTPError(400):
        _run(validate_image(upload))


# ============================================================
# PDF validation
# ============================================================
def test_validate_pdf_accepts_real_pdf():
    pdf_bytes = b"%PDF-1.4\n%some content here\n%%EOF"
    upload = _upload(pdf_bytes, "doc.pdf")
    assert _run(validate_pdf(upload)) == pdf_bytes


def test_validate_pdf_rejects_image():
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    upload = _upload(jpeg_bytes, "photo.pdf")
    with __pytest_raises_HTTPError(400):
        _run(validate_pdf(upload))


# ============================================================
# Image or PDF
# ============================================================
def test_validate_image_or_pdf_accepts_both():
    pdf = b"%PDF-1.4\n..."
    jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    r1 = _run(validate_image_or_pdf(_upload(pdf, "doc.pdf")))
    r2 = _run(validate_image_or_pdf(_upload(jpg, "photo.jpg")))
    assert r1 == pdf
    assert r2 == jpg


def test_validate_image_or_pdf_rejects_executable():
    """Reject .exe renamed as .pdf — magic bytes won't match."""
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00"  # PE header
    upload = _upload(fake_pdf, "malware.pdf")
    with __pytest_raises_HTTPError(400):
        _run(validate_image_or_pdf(upload))


# ============================================================
# Data sheet validation
# ============================================================
def test_validate_data_sheet_accepts_xlsx():
    xlsx = b"PK\x03\x04" + b"x" * 100
    upload = _upload(xlsx, "data.xlsx")
    assert _run(validate_data_sheet(upload)) == xlsx


def test_validate_data_sheet_accepts_csv():
    csv = b"name,phone\nAhmed,01012345678\n"
    upload = _upload(csv, "customers.csv")
    assert _run(validate_data_sheet(upload)) == csv


def test_validate_data_sheet_rejects_image():
    jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    upload = _upload(jpg, "photo.xlsx")
    with __pytest_raises_HTTPError(400):
        _run(validate_data_sheet(upload))


# ============================================================
# Helper: context manager to assert HTTPException
# ============================================================
class __pytest_raises_HTTPError:
    """Tiny context manager that asserts an HTTPException with the given status.

    Avoids depending on pytest.raises so the file works as a standalone script too.
    """

    def __init__(self, status_code: int):
        self.expected = status_code

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            raise AssertionError(f"Expected HTTPException {self.expected}, got none")
        if not isinstance(exc, HTTPException):
            raise AssertionError(f"Expected HTTPException, got {type(exc).__name__}: {exc}")
        if exc.status_code != self.expected:
            raise AssertionError(
                f"Expected status {self.expected}, got {exc.status_code}: {exc.detail}"
            )
        return True  # suppress
