"""Throwaway: seed the owner-editable about fields so the section can be seen.

Not part of the application. Run with:
    $env:PYTHONPATH="." ; .\.venv\Scripts\python.exe scripts\_seed_about_demo.py

`business_settings` is a single-row table of real columns, so this writes the
two existing ones plus the three the about section reads that had no column yet
(image, alt, years). The three are added through `settings` JSON rather than a
migration because the public site already reads arbitrary keys from that
snapshot.
"""

import json

from app.db.session import SessionLocal
from sqlalchemy import text

with SessionLocal() as db:
    db.execute(
        text(
            "UPDATE business_settings SET "
            "  landing_about_title = :title, "
            "  landing_about_content = :body, "
            "  landing_features = :features, "
            "  updated_at = CURRENT_TIMESTAMP"
        ),
        {
            "title": "أكثر من مجرد حلاقة — مكان تثق فيه بإطلالتك",
            "body": (
                "بدأنا بحلاق واحد وفكرة واضحة: خدمة محترمة تحترم وقت العميل.\n"
                "واليوم يضم فريقنا متخصصين في القص الكلاسيكي والتدرجات الحديثة والعناية."
            ),
            "features": json.dumps(
                [
                    {
                        "title": "أدوات معقمة لكل عميل",
                        "description": "شفرة جديدة وأدوات معقمة بعد كل عميل، من غير استثناء.",
                    },
                    {
                        "title": "مواعيد دقيقة من غير انتظار",
                        "description": "الحجز بالموعد، وليس بالدور. نلتزم بوقتك.",
                    },
                    {
                        "title": "استشارة مجانية قبل القص",
                        "description": "نناقش الشكل المناسب لوجهك وشعرك قبل البدء.",
                    },
                ],
                ensure_ascii=False,
            ),
        },
    )

    # The three fields with no column yet ride in the public snapshot, which is
    # the bag the public site already reads settings out of.
    db.execute(
        text("SELECT public_site_snapshot FROM business_settings LIMIT 1"),
    ).first()
    snapshot = db.execute(
        text("SELECT public_site_snapshot FROM business_settings LIMIT 1")
    ).scalar()
    payload = {}
    if snapshot:
        try:
            payload = json.loads(snapshot) if isinstance(snapshot, str) else dict(snapshot)
        except (ValueError, TypeError):
            payload = {}

    payload.update(
        {
            "landing_about_years_experience": "8",
            "landing_about_image_url": (
                "https://images.unsplash.com/photo-1621605815971-fbc98d665033"
                "?q=80&w=1200&auto=format&fit=crop"
            ),
            "landing_about_image_alt": "حلاق في صالون Salon Pro",
        }
    )

    db.execute(
        text("UPDATE business_settings SET public_site_snapshot = :snap"),
        {"snap": json.dumps(payload, ensure_ascii=False)},
    )
    db.commit()
    print("seeded about settings")