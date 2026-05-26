from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class SeoPage(Base):
    __tablename__ = "seo_pages"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    city = Column(String(100), nullable=False)
    area = Column(String(100), nullable=False)
    
    title_ar = Column(String(255), nullable=False)
    meta_description_ar = Column(Text, nullable=True)
    hero_title_ar = Column(String(255), nullable=True)
    hero_subtitle_ar = Column(Text, nullable=True)
    
    content_ar = Column(Text, nullable=True) # Markdown or HTML content
    faq_json = Column(Text, nullable=True) # JSON string for FAQ schema
    
    is_published = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)



