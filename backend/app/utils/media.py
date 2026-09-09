import io
import os
import uuid
import logging
from pathlib import Path
from typing import Optional

from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
MAX_DIMENSION = 1920  # Max width or height
DEFAULT_QUALITY = 85
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def process_image_content(
    content: bytes,
    original_filename: str,
    upload_dir: Path,
    max_size: int = MAX_FILE_SIZE,
    quality: int = DEFAULT_QUALITY,
    target_format: str = "JPEG"
) -> str:
    """
    Validates, optimizes, and saves image content.
    Returns the filename of the saved image.
    """
    # 1. Size Validation
    content_size = len(content)
    if content_size == 0:
        logger.error("Empty file content received")
        raise HTTPException(status_code=400, detail="الملف فارغ")
    
    if content_size > max_size:
        logger.error(f"File size {content_size} exceeds max {max_size}")
        raise HTTPException(
            status_code=400, 
            detail=f"حجم الملف كبير جداً. الحد الأقصى هو {max_size // (1024*1024)} ميجابايت"
        )
    
    # 2. Extension & Path Setup
    ext = Path(original_filename).suffix.lower()
    if not ext:
        ext = ".jpg"
        
    if ext not in ALLOWED_EXTENSIONS:
        logger.error(f"Unsupported extension: {ext}")
        raise HTTPException(
            status_code=400, 
            detail=f"نوع الملف {ext} غير مدعوم. الأنواع المسموحة: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Standardize filename
    _uid = uuid.uuid4().hex
    unique_name = f"{_uid}.jpg"
    if ext == ".png":
        unique_name = f"{_uid}.png"
    elif ext == ".webp":
        unique_name = f"{_uid}.webp"
        
    upload_dir.mkdir(parents=True, exist_ok=True)
    save_path = upload_dir / unique_name
    logger.info(f"Processing image: {original_filename} -> {save_path}")

    try:
        # 3. Process with Pillow
        img = Image.open(io.BytesIO(content))
        
        # Fix Orientation based on EXIF
        img = ImageOps.exif_transpose(img)
        
        # Convert to RGB if saving as JPEG (removes alpha channel if present)
        if target_format == "JPEG" and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        
        # 4. Smart Resizing
        width, height = img.size
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            if width > height:
                new_width = MAX_DIMENSION
                new_height = int(MAX_DIMENSION * height / width)
            else:
                new_height = MAX_DIMENSION
                new_width = int(MAX_DIMENSION * width / height)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # 5. Save with Optimization
        if ext == ".png":
            img.save(save_path, format="PNG", optimize=True)
        elif ext == ".webp":
            img.save(save_path, format="WEBP", quality=quality, method=6)
        else:
            img.save(save_path, format="JPEG", quality=quality, optimize=True, progressive=True)
            
        logger.info(f"Successfully saved optimized image to {save_path}")
        return unique_name

    except UnidentifiedImageError:
        logger.error(f"Failed to identify image: {original_filename}")
        raise HTTPException(status_code=400, detail="الملف المرفوع ليس صورة صالحة")
    except Exception as e:
        logger.exception(f"Image Processing Error: {str(e)}")
        raise HTTPException(status_code=500, detail="حدث خطأ أثناء معالجة الصورة")

def get_upload_path(folder_name: str) -> Path:
    """Gets absolute path for uploads folder - must match main.py."""
    import os
    env_dir = os.getenv("UPLOADS_DIR")
    if env_dir:
        return Path(env_dir) / folder_name
    cur = Path(__file__).resolve()
    # Docker
    if cur.as_posix().startswith("/app/"):
        return Path("/app/uploads") / folder_name
    # Local: backend/app/utils/media.py -> parents[3] == project root (Salon-Management-Pro)
    # Verified: parents[0]=utils,1=app,2=backend,3=project root
    return cur.parents[3] / "uploads" / folder_name
