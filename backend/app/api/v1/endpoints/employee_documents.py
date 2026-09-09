from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import uuid
import shutil

from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.employee import Employee
from app.models.employee_document import EmployeeDocument

router = APIRouter(prefix="/employees", tags=["Employee Documents"])

from sqlalchemy import and_
from datetime import timedelta

@router.get("/expiring")
def get_expiring_documents(
    days: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    """
    Get documents expiring within the next N days
    """
    threshold = datetime.now() + timedelta(days=days)
    docs = db.query(EmployeeDocument).filter(
        and_(
            EmployeeDocument.expiry_date != None,
            EmployeeDocument.expiry_date <= threshold,
            EmployeeDocument.expiry_date >= datetime.now()
        )
    ).all()
    
    result = []
    for doc in docs:
        result.append({
            "id": doc.id,
            "employee_id": doc.employee_id,
            "employee_name": doc.employee.full_name if doc.employee else "Unknown",
            "title": doc.title,
            "file_type": doc.file_type,
            "expiry_date": doc.expiry_date,
            "file_url": doc.file_url
        })
    return result

@router.post("/{employee_id}/documents")
def upload_employee_document(
    employee_id: int,
    title: str = Form(...),
    file_type: str = Form("other"),
    expiry_date: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # Verify employee exists
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")

    # Ensure directory exists
    os.makedirs("uploads/documents", exist_ok=True)
    
    # Professional Naming Convention: EMP_NAME_TYPE_DATE_UUID{EXT}
    ext = os.path.splitext(file.filename)[1]
    safe_name = (employee.full_name or "EMP").replace(" ", "_")[:20]
    safe_type = file_type.replace(" ", "_").upper()
    date_str = datetime.now().strftime("%Y%m%d")
    unique_id = uuid.uuid4().hex[:6]
    
    filename = f"EMP_{safe_name}_{safe_type}_{date_str}_{unique_id}{ext}"
    file_path = os.path.join("uploads/documents", filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    parsed_expiry = None
    if expiry_date:
        try:
            parsed_expiry = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
        except ValueError:
            pass

    # Save record to DB
    doc = EmployeeDocument(
        employee_id=employee_id,
        title=title,
        file_url=f"/uploads/documents/{filename}",
        file_type=file_type,
        expiry_date=parsed_expiry
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    return doc

@router.get("/{employee_id}/documents")
def list_employee_documents(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    docs = db.query(EmployeeDocument).filter(EmployeeDocument.employee_id == employee_id).all()
    return docs

@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    doc = db.query(EmployeeDocument).filter(EmployeeDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="المستند غير موجود")
    
    # Delete file from disk
    file_url = doc.file_url
    if file_url.startswith("/"):
        file_url = file_url[1:]
    
    if os.path.exists(file_url):
        os.remove(file_url)
        
    db.delete(doc)
    db.commit()
    return None
