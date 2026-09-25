import uuid
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import require_manage_employees
from app.core.upload_security import (
    assert_safe_destination,
    sanitize_filename,
    validate_image_or_pdf,
)
from app.core.rbac import can_access
from app.db.session import get_db
from app.models.employee import Employee
from app.models.employee_document import EmployeeDocument
from app.models.user import User
from app.utils.media import get_upload_path

router = APIRouter(prefix="/employees", tags=["Employee Documents"])


def _ensure_document_access(
    db: Session,
    employee: Employee | None,
    current_user: User,
) -> None:
    if employee is None or not employee.user_id:
        return
    linked_user = db.query(User).filter(User.id == employee.user_id).first()
    if linked_user and not can_access(linked_user.role, current_user.role):
        raise HTTPException(
            status_code=403,
            detail="لا يمكنك الوصول إلى مستندات موظف بدور أعلى",
        )


def _resolve_document_path(
    document: EmployeeDocument,
    *,
    require_exists: bool = True,
) -> Path:
    root = get_upload_path("documents").resolve()
    storage_key = document.storage_key
    if not storage_key and document.file_url:
        parsed_path = urlparse(document.file_url).path
        prefix = "/uploads/documents/"
        if parsed_path.startswith(prefix):
            storage_key = unquote(parsed_path[len(prefix) :])
    if not storage_key:
        raise HTTPException(status_code=404, detail="ملف المستند غير موجود")

    target = (root / storage_key).resolve(strict=False)
    assert_safe_destination(root, target)
    if require_exists and not target.is_file():
        raise HTTPException(status_code=404, detail="ملف المستند غير موجود")
    return target


@router.get("/expiring")
def get_expiring_documents(
    days: int = Query(15, ge=1, le=365),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    now = datetime.now()
    threshold = now + timedelta(days=days)
    docs = (
        db.query(EmployeeDocument)
        .filter(
            EmployeeDocument.expiry_date.isnot(None),
            EmployeeDocument.expiry_date >= now,
            EmployeeDocument.expiry_date <= threshold,
        )
        .order_by(EmployeeDocument.expiry_date.asc())
        .limit(limit)
        .all()
    )
    result = []
    for doc in docs:
        try:
            _ensure_document_access(db, doc.employee, current_user)
        except HTTPException:
            continue
        result.append(
            {
                "id": doc.id,
                "employee_id": doc.employee_id,
                "employee_name": doc.employee.full_name if doc.employee else "Unknown",
                "title": doc.title,
                "file_type": doc.file_type,
                "expiry_date": doc.expiry_date,
                "file_url": doc.file_url,
            }
        )
    return result


@router.post("/{employee_id}/documents")
async def upload_employee_document(
    employee_id: int,
    title: str = Form(...),
    file_type: str = Form("other"),
    expiry_date: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_document_access(db, employee, current_user)

    clean_title = title.strip()
    clean_type = sanitize_filename(file_type, fallback="other")[:50]
    if not clean_title or len(clean_title) > 255:
        raise HTTPException(status_code=400, detail="عنوان المستند غير صالح")
    if not clean_type or len(clean_type) > 50:
        raise HTTPException(status_code=400, detail="نوع المستند غير صالح")

    content = await validate_image_or_pdf(file, max_size=10 * 1024 * 1024)
    extension = Path(file.filename or "").suffix.lower()
    upload_root = get_upload_path("documents").resolve()
    upload_root.mkdir(parents=True, exist_ok=True)
    storage_key = f"{uuid.uuid4().hex}{extension}"
    target = (upload_root / storage_key).resolve(strict=False)
    assert_safe_destination(upload_root, target)
    target.write_bytes(content)

    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
        except ValueError:
            parsed_expiry = None

    document = EmployeeDocument(
        employee_id=employee.id,
        title=clean_title,
        file_url="pending",
        storage_key=storage_key,
        file_type=clean_type,
        expiry_date=parsed_expiry,
    )
    try:
        db.add(document)
        db.flush()
        document.file_url = f"/api/v1/employees/documents/{document.id}/download"
        db.commit()
        db.refresh(document)
    except Exception:
        db.rollback()
        target.unlink(missing_ok=True)
        raise
    return document


@router.get("/documents/{document_id}/download")
def download_employee_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="المستند غير موجود")
    _ensure_document_access(db, document.employee, current_user)
    target = _resolve_document_path(document)
    return FileResponse(
        target,
        filename=f"{document.title}{target.suffix}",
        media_type="application/octet-stream",
    )


@router.get("/{employee_id}/documents")
def list_employee_documents(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    _ensure_document_access(db, employee, current_user)
    return (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.employee_id == employee_id)
        .all()
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manage_employees),
):
    document = (
        db.query(EmployeeDocument)
        .filter(EmployeeDocument.id == document_id)
        .first()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="المستند غير موجود")
    _ensure_document_access(db, document.employee, current_user)

    target = _resolve_document_path(document, require_exists=False)
    if target.is_file():
        target.unlink()
    db.delete(document)
    db.commit()
    return None
