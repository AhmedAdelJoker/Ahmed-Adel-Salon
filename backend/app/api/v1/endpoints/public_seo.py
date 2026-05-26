from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.seo_page import SeoPage
from app.schemas.seo_page import SeoPageRead

router = APIRouter(prefix="/seo", tags=["Public SEO Pages"])

@router.get("/pages", response_model=List[SeoPageRead])
def list_published_seo_pages(db: Session = Depends(get_db)):
    return db.query(SeoPage).filter(SeoPage.is_published == True).all()

@router.get("/pages/{slug}", response_model=SeoPageRead)
def get_seo_page_by_slug(slug: str, db: Session = Depends(get_db)):
    page = db.query(SeoPage).filter(SeoPage.slug == slug, SeoPage.is_published == True).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page



