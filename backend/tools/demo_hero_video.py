"""Temporary demo-state switch for the public-site hero video.

Used only to photograph the hero with a moving clip for visual review. It edits
the live settings row AND the published snapshot (the public site reads the
snapshot, not the live row), and `revert` puts both back.

    python tools/demo_hero_video.py apply / revert
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.db.session import SessionLocal  # noqa: E402
from app.models.business_settings import BusinessSettings  # noqa: E402
from app.core.upload_security import get_upload_path  # noqa: E402

# Must use the canonical resolver, not backend/uploads: on this machine the data
# dir is an external sibling folder (SalonPro_External/data/uploads), and the
# FastAPI static mount serves that path. Writing anywhere else yields a file the
# site can never fetch.
UPLOAD_DIR = get_upload_path("business")
CLIP_SRC = BACKEND / "logs" / "demo-hero.mp4"
VIDEO_NAME = "hero_demo_preview.mp4"
POSTER_NAME = "hero_demo_preview.jpg"

DEFAULTS = {
    "landing_hero_video_url": "",
    "landing_video_poster_url": "",
    "landing_video_autoplay": True,
    "landing_video_muted": True,
    "landing_motion_enabled": True,
}


def _row(db):
    row = db.query(BusinessSettings).first()
    if row is None:
        raise SystemExit("no BusinessSettings row exists")
    return row


def _write(row, values: dict) -> None:
    for key, val in values.items():
        setattr(row, key, val)
    snap = dict(row.public_site_snapshot or {})
    snap.update(values)
    row.public_site_snapshot = snap


def apply() -> None:
    if CLIP_SRC.exists():
        shutil.copy2(CLIP_SRC, UPLOAD_DIR / VIDEO_NAME)
    elif not (UPLOAD_DIR / VIDEO_NAME).exists():
        raise SystemExit(f"no clip to apply: {CLIP_SRC} and {UPLOAD_DIR / VIDEO_NAME}")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        row = _row(db)
        _write(
            row,
            {
                "landing_hero_video_url": f"/uploads/business/{VIDEO_NAME}",
                "landing_video_poster_url": f"/uploads/business/{POSTER_NAME}",
                "landing_video_autoplay": True,
                "landing_video_muted": True,
                "landing_motion_enabled": True,
            },
        )
        db.commit()
    print(f"applied: video + poster live, snapshot updated")


def revert() -> None:
    with SessionLocal() as db:
        row = _row(db)
        _write(row, DEFAULTS)
        db.commit()
    for name in (VIDEO_NAME, POSTER_NAME):
        target = UPLOAD_DIR / name
        if target.exists():
            target.unlink()
    print("reverted: DB defaults restored, demo files removed")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "apply":
        apply()
    elif mode == "revert":
        revert()
    else:
        raise SystemExit("usage: demo_hero_video.py apply|revert")