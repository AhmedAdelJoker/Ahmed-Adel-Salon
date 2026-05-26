from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class SeoPageBase(BaseModel):
    slug: str
    city: str
    area: str
    title_ar: str
    meta_description_ar: Optional[str] = None
    hero_title_ar: Optional[str] = None
    hero_subtitle_ar: Optional[str] = None
    content_ar: Optional[str] = None
    faq_json: Optional[str] = None
    is_published: bool = True

class SeoPageCreate(SeoPageBase):
    pass

class SeoPageRead(SeoPageBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



