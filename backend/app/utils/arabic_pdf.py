import arabic_reshaper
from bidi.algorithm import get_display
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

PDF_FONT_NAME = "SalonArabic"
# Priority fonts for Arabic
ARIAL_FONT_PATH = Path(r"C:\Windows\Fonts\arial.ttf")
# Fallback to Alexandria if we can find it in the project, but for now system font is safer if running on Windows.
# On Linux, we might need a specific path or bundle a font.

def fix_arabic(text: str) -> str:
    """Reshape and reorder Arabic text for ReportLab."""
    if not text:
        return ""
    try:
        reshaped_text = arabic_reshaper.reshape(str(text))
        bidi_text = get_display(reshaped_text)
        return bidi_text
    except Exception:
        return str(text)

def ensure_pdf_font() -> str:
    """Registers and returns a font that supports Arabic."""
    if PDF_FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return PDF_FONT_NAME
    
    if ARIAL_FONT_PATH.exists():
        try:
            pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, str(ARIAL_FONT_PATH)))
            return PDF_FONT_NAME
        except Exception:
            pass
            
    return "Helvetica"
