"""
External data directory resolver - يحل مسار المجلد الخارجي بره المشروع.
كل ملفات البرنامج (DB + uploads + invoices) تروح هناك وما تتمسح مع المشروع.
"""
import os
from pathlib import Path


def get_external_data_dir() -> Path:
    """
    ترتيب الأولوية:
    1. متغير البيئة SALON_DATA_DIR
    2. متغير البيئة SALON_EXTERNAL_DIR
    3. مجلد بجانب الـ exe عند التشغيل كبرنامج ويندوز (portable)
    4. مجلد أخ خارج المشروع (sibling) في وضع التطوير
    5. Documents/SalonProData كـ fallback
    """
    # 1. Env override
    for key in ("SALON_DATA_DIR", "SALON_EXTERNAL_DIR", "EXTERNAL_DATA_DIR"):
        v = os.getenv(key)
        if v:
            return Path(v)

    # 2. Portable: بجانب الـ exe (عندما يكون packaged)
    # نكتشف عبر SALON_PACKAGED أو وجود ملف بجانب exe
    exe_dir = None
    try:
        import sys
        if getattr(sys, "frozen", False):
            exe_dir = Path(sys.executable).resolve().parent
            candidate = exe_dir / "SalonProData"
            # نرجعها حتى لو لم توجد بعد - سيتم إنشاؤها
            return candidate
        # تشخيص بديل: إذا UPLOADS_DIR مضبوط من Electron سيُستخدم أعلاه
    except Exception:
        pass

    # 3. مجلد خارج المشروع - sibling لـ Salon-Management-Pro (المختار من المستخدم)
    # backend/app/core/paths.py -> parents[3] == Salon-Management-Pro parent (Downloads)
    cur = Path(__file__).resolve()
    try:
        project_parent = cur.parents[3]  # .../Salon-Management-Pro/.. -> Downloads
        # المسار المحدد من المستخدم
        chosen = project_parent / "SalonPro_External"
        if chosen.exists():
            return chosen
        # توافق مع الاسم القديم
        legacy = project_parent / "SalonPro_External_Data"
        if legacy.exists():
            return legacy
        return chosen
    except Exception:
        pass

    # 4. Fallback: Documents
    try:
        docs = Path.home() / "Documents" / "SalonProData"
        return docs
    except Exception:
        return Path.cwd() / "SalonProData"


def get_data_dir() -> Path:
    p = get_external_data_dir() / "data"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_uploads_dir() -> Path:
    """Single canonical uploads location — UPLOADS_DIR env > Docker > external data dir."""
    # يحترم UPLOADS_DIR أولاً (يضبطه Electron)
    env = os.getenv("UPLOADS_DIR")
    if env:
        p = Path(env)
        p.mkdir(parents=True, exist_ok=True)
        return p
    # Docker: /app is the container workdir
    cur = Path(__file__).resolve()
    if cur.as_posix().startswith("/app/"):
        p = Path("/app/uploads")
        p.mkdir(parents=True, exist_ok=True)
        return p
    p = get_data_dir() / "uploads"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_db_path() -> Path:
    # إذا DATABASE_URL مضبوط وفيه sqlite مسار مطلق نستخدمه
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("sqlite"):
        # sqlite:///./salon_pro.db  -> نسبي
        # sqlite:///C:/path/db.db  -> مطلق
        try:
            path_part = db_url.replace("sqlite:///", "").replace("sqlite://", "")
            if path_part and (":\\" in path_part or path_part.startswith("/")):
                # مسار مطلق مضبوط من Electron
                return Path(path_part)
        except Exception:
            pass
    return get_data_dir() / "salon_pro.db"


def get_pdf_dir() -> Path:
    env = os.getenv("PDF_DIR") or os.getenv("INVOICE_DIR")
    if env:
        p = Path(env)
        p.mkdir(parents=True, exist_ok=True)
        return p
    p = get_data_dir() / "generated_invoices"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_receipt_dir() -> Path:
    env = os.getenv("RECEIPT_DIR")
    if env:
        p = Path(env)
        p.mkdir(parents=True, exist_ok=True)
        return p
    p = get_data_dir() / "generated_receipts"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_backups_dir() -> Path:
    p = get_external_data_dir() / "backups"
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_logs_dir() -> Path:
    p = get_external_data_dir() / "logs"
    p.mkdir(parents=True, exist_ok=True)
    return p


def migrate_legacy_data():
    """
    ينقل ملفات قديمة من داخل المشروع للمجلد الخارجي (مرة واحدة).
    """
    import shutil
    import logging
    logger = logging.getLogger("paths.migrate")
    cur = Path(__file__).resolve()
    # مواقع قديمة
    project_root = None
    try:
        project_root = cur.parents[3]  # Downloads
        # actually Salon-Management-Pro is at parents[3]? let's compute
        # paths.py at backend/app/core/paths.py
        # parents[0]=core,1=app,2=backend,3=Salon-Management-Pro
        project_root = cur.parents[3]
    except Exception:
        return
    legacy_roots = [
        project_root / "uploads",
        project_root / "backend" / "uploads",
        cur.parents[2] / "uploads",  # backend/uploads
        Path.cwd() / "uploads",
    ]
    # أيضاً legacy من parents[3]/uploads القديم الخاطئ (Downloads/uploads)
    try:
        legacy_roots.append(cur.parents[4] / "uploads")
    except Exception:
        pass

    dest_uploads = get_uploads_dir()
    for legacy in legacy_roots:
        if not legacy.exists() or legacy.resolve() == dest_uploads.resolve():
            continue
        try:
            for item in legacy.rglob("*"):
                if item.is_file():
                    rel = item.relative_to(legacy)
                    dest = dest_uploads / rel
                    if dest.exists():
                        continue
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    try:
                        shutil.copy2(item, dest)
                        logger.info(f"Migrated {item} -> {dest}")
                    except Exception as e:
                        logger.warning(f"Copy failed {item}: {e}")
        except Exception as e:
            logger.warning(f"Migrate legacy {legacy} failed: {e}")

    # DB migration
    legacy_dbs = [
        project_root / "salon_pro.db",
        project_root / "backend" / "salon_pro.db",
        project_root / "backend" / "salon.db",
        project_root / "backend" / "app.db",
        Path.cwd() / "salon_pro.db",
    ]
    dest_db = get_db_path()
    # إذا كان dest_db لسه فاضي وهناك legacy فيه بيانات
    if not dest_db.exists() or dest_db.stat().st_size == 0:
        for ldb in legacy_dbs:
            if ldb.exists() and ldb.stat().st_size > 0:
                try:
                    dest_db.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(ldb, dest_db)
                    logger.info(f"Migrated DB {ldb} -> {dest_db}")
                    break
                except Exception as e:
                    logger.warning(f"DB copy failed: {e}")

    # PDF migration
    legacy_pdfs = [
        project_root / "backend" / "generated_invoices",
        project_root / "generated_invoices",
        cur.parents[2] / "generated_invoices",
    ]
    dest_pdf = get_pdf_dir()
    for lp in legacy_pdfs:
        if not lp.exists() or lp.resolve() == dest_pdf.resolve():
            continue
        try:
            for f in lp.glob("*.pdf"):
                d = dest_pdf / f.name
                if not d.exists():
                    shutil.copy2(f, d)
        except Exception:
            pass
