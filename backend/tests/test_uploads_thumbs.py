"""The `?w=` thumb middleware for /uploads.

The public site asks for small variants (`?w=160`) of salon media; the old
StaticFiles ignored the parameter and served full-size originals. These tests
hold the middleware to its gates: a real downscaled copy for a valid request,
byte-for-byte fallthrough (never an invented 404) for everything it must not
touch, and no traversal.
"""
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient
from PIL import Image


@pytest.fixture()
def uploads_root(tmp_path: Path) -> Path:
    root = tmp_path / "uploads"
    (root / "business").mkdir(parents=True)
    (root / "services").mkdir(parents=True)
    return root


@pytest.fixture()
def thumb_client(uploads_root: Path):
    from app.core.image_thumbs import maybe_resized_upload

    app = FastAPI()

    @app.middleware("http")
    async def thumbs(request, call_next):
        return await maybe_resized_upload(request, call_next, uploads_root=uploads_root)

    app.mount("/uploads/business", StaticFiles(directory=str(uploads_root / "business")))
    app.mount("/uploads/services", StaticFiles(directory=str(uploads_root / "services")))
    return TestClient(app)


def _jpeg(uploads_root: Path, name: str, width: int, height: int) -> None:
    img = Image.new("RGB", (width, height), (200, 30, 30))
    img.save(uploads_root / "business" / name, "JPEG", quality=90)


def test_w_param_serves_a_downscaled_copy(thumb_client, uploads_root):
    _jpeg(uploads_root, "big.jpg", 1920, 1080)
    r = thumb_client.get("/uploads/business/big.jpg?w=160")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert "public, max-age=86400" in r.headers["cache-control"]
    img = Image.open(__import__("io").BytesIO(r.content))
    assert img.size == (160, 90)
    # the thumb is cached on disk for later requests
    thumbs = list((uploads_root / ".thumbs").glob("*.jpg"))
    assert len(thumbs) == 1


def test_second_wide_request_skips_upscale(thumb_client, uploads_root):
    _jpeg(uploads_root, "small.jpg", 100, 100)
    r = thumb_client.get("/uploads/business/small.jpg?w=160")
    assert r.status_code == 200
    img = Image.open(__import__("io").BytesIO(r.content))
    assert img.size == (100, 100)


def test_no_w_param_is_untouched_fullsize_fallthrough(thumb_client, uploads_root):
    _jpeg(uploads_root, "orig.jpg", 400, 300)
    r = thumb_client.get("/uploads/business/orig.jpg")
    assert r.status_code == 200
    img = Image.open(__import__("io").BytesIO(r.content))
    assert img.size == (400, 300)


def test_missing_file_returns_staticfiles_own_404(thumb_client):
    r = thumb_client.get("/uploads/business/nope.jpg?w=160")
    assert r.status_code == 404


def test_traversal_never_serves_outside_uploads(thumb_client, uploads_root):
    secret = uploads_root / "secret.jpg"
    Image.new("RGB", (10, 10)).save(secret)
    r = thumb_client.get("/uploads/business/../secret.jpg?w=160")
    assert r.status_code == 404


def test_unknown_subdir_is_not_resizable(thumb_client, uploads_root):
    (uploads_root / "invoices").mkdir()
    Image.new("RGB", (800, 600)).save(uploads_root / "invoices" / "doc.jpg")
    # no mount exists for /uploads/invoices — StaticFiles handles the miss
    r = thumb_client.get("/uploads/invoices/doc.jpg?w=160")
    assert r.status_code == 404


def test_bad_widths_fall_through_to_the_original(thumb_client, uploads_root):
    _jpeg(uploads_root, "w.jpg", 500, 500)
    for bad in ("abc", "-1", "12"):
        r = thumb_client.get(f"/uploads/business/w.jpg?w={bad}")
        assert r.status_code == 200
        Image.open(__import__("io").BytesIO(r.content)).size == (500, 500)


def test_etag_304(thumb_client, uploads_root):
    _jpeg(uploads_root, "etag.jpg", 600, 400)
    first = thumb_client.get("/uploads/business/etag.jpg?w=160")
    etag = first.headers["etag"]
    again = thumb_client.get(
        "/uploads/business/etag.jpg?w=160", headers={"If-None-Match": etag}
    )
    assert again.status_code == 304


def test_png_source_stays_png(thumb_client, uploads_root):
    img = Image.new("RGB", (900, 500), (10, 100, 10))
    img.save(uploads_root / "business" / "pic.png")
    r = thumb_client.get("/uploads/business/pic.png?w=200")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    out = Image.open(__import__("io").BytesIO(r.content))
    assert out.size == (200, 111)
