from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from typing import List
import os
import uuid
import shutil

from app.db.session import get_db
from app.db.base_class import Base
from app.api.deps import require_owner_or_manager
from app.models.user import User

router = APIRouter(prefix="/employees", tags=["Employee Documents"])

# Minimal Model for Documents (usually would be in app/models/employee_document.py)
class EmployeeDocument(Base):
    __tablename__ = "employee_documents"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    file_url = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=True) # ID, Contract, Certificate, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

@router.post("/{employee_id}/documents")
def upload_employee_document(
    employee_id: int,
    title: str,
    file_type: str = "other",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    # Ensure directory exists
    os.makedirs("uploads/documents", exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    filename = f"{employee_id}_{uuid.uuid4()}{ext}"
    file_path = os.path.join("uploads/documents", filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Save record to DB
    doc = EmployeeDocument(
        employee_id=employee_id,
        title=title,
        file_url=f"/uploads/documents/{filename}",
        file_type=file_type
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
    full_path = doc.file_url.lstrip("/")
    if os.path.exists(full_path):
        os.remove(full_path)
        
    db.delete(doc)
    db.commit()
    return None
