from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from app.utils.arabic_pdf import fix_arabic, ensure_pdf_font


try:
    from app.core.paths import get_pdf_dir, get_receipt_dir
    PDF_DIR = get_pdf_dir()
    RECEIPT_DIR = get_receipt_dir()
    BASE_DIR = PDF_DIR.parent
except Exception:
    BASE_DIR = Path(__file__).resolve().parents[2]
    PDF_DIR = BASE_DIR / "generated_invoices"
    RECEIPT_DIR = BASE_DIR / "generated_receipts"


def ensure_pdf_dir():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    return PDF_DIR


def ensure_receipt_dir():
    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    return RECEIPT_DIR


def generate_invoice_pdf(invoice, items, customer, barber=None, shop_name="Salon Management Pro", shop_phone=None):
    """
    إنشاء PDF للفواتير وإرجاع المسار النهائي
    """
    ensure_pdf_dir()
    font_name = ensure_pdf_font()

    filename = f"invoice_{invoice.invoice_no}.pdf"
    file_path = PDF_DIR / filename

    c = canvas.Canvas(str(file_path), pagesize=A4)
    width, height = A4

    y = height - 20 * mm

    # Header
    c.setFont(font_name, 18)
    c.drawRightString(width - 20 * mm, y, fix_arabic("Invoice / فاتورة"))
    y -= 10 * mm

    c.setFont(font_name, 11)
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"المحل: {shop_name}"))
    y -= 6 * mm
    if shop_phone:
        c.drawRightString(width - 20 * mm, y, fix_arabic(f"الهاتف: {shop_phone}"))
        y -= 6 * mm

    c.drawRightString(width - 20 * mm, y, fix_arabic(f"رقم الفاتورة: {invoice.invoice_no}"))
    y -= 6 * mm
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"التاريخ: {invoice.created_at.strftime('%Y-%m-%d %H:%M')}"))
    y -= 10 * mm

    # Customer info
    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
    c.setFont(font_name, 12)
    c.drawRightString(width - 20 * mm, y, fix_arabic("بيانات العميل"))
    y -= 6 * mm

    c.setFont(font_name, 11)
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"الاسم: {customer_name}"))
    y -= 6 * mm
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"الهاتف: {customer.phone or '-'}"))
    y -= 6 * mm

    if barber:
        b_name = barber.display_name or barber.full_name
        c.drawRightString(width - 20 * mm, y, fix_arabic(f"الموظف: {b_name}"))
        y -= 8 * mm
    else:
        y -= 2 * mm

    # Table Header
    c.setFont(font_name, 11)
    c.drawRightString(50 * mm, y, fix_arabic("الخدمة"))
    c.drawRightString(100 * mm, y, fix_arabic("الكمية"))
    c.drawRightString(135 * mm, y, fix_arabic("سعر الوحدة"))
    c.drawRightString(170 * mm, y, fix_arabic("الإجمالي"))
    y -= 5 * mm

    c.line(20 * mm, y, 190 * mm, y)
    y -= 6 * mm

    # Items
    c.setFont(font_name, 10)
    for item in items:
        c.drawRightString(50 * mm, y, fix_arabic(str(item.service_name)))
        c.drawRightString(100 * mm, y, fix_arabic(str(item.quantity)))
        c.drawRightString(135 * mm, y, fix_arabic(f"{float(item.unit_price):.2f}"))
        c.drawRightString(170 * mm, y, fix_arabic(f"{float(item.total_price):.2f}"))
        y -= 6 * mm

        # لو الصفحة امتلأت
        if y < 30 * mm:
            c.showPage()
            y = height - 20 * mm
            c.setFont(font_name, 10)

    y -= 6 * mm
    c.line(20 * mm, y, 190 * mm, y)
    y -= 8 * mm

    c.setFont(font_name, 12)
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"المبلغ الإجمالي: {float(invoice.total_amount):.2f} EGP"))

    y -= 15 * mm
    c.setFont(font_name, 10)
    c.drawRightString(width - 20 * mm, y, fix_arabic("Thank you for your visit / شكرًا لزيارتكم"))

    c.save()

    return str(file_path)


def generate_cash_receipt_pdf(transaction, settings=None):
    """
    إنشاء إيصال PDF لحركة خزنة وإرجاع المسار النهائي.
    """
    ensure_receipt_dir()
    font_name = ensure_pdf_font()

    filename = f"receipt_TX_{transaction.id}.pdf"
    file_path = RECEIPT_DIR / filename

    c = canvas.Canvas(str(file_path), pagesize=A4)
    width, height = A4
    y = height - 20 * mm

    shop_name = getattr(settings, "salon_name", None) or "Salon Management Pro"
    shop_phone = getattr(settings, "shop_phone", None)
    currency = getattr(settings, "currency", None) or "EGP"

    c.setFont(font_name, 18)
    c.drawRightString(width - 20 * mm, y, fix_arabic("Cash Receipt / إيصال خزنة"))
    y -= 12 * mm

    c.setFont(font_name, 11)
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"المحل: {shop_name}"))
    y -= 6 * mm
    if shop_phone:
        c.drawRightString(width - 20 * mm, y, fix_arabic(f"الهاتف: {shop_phone}"))
        y -= 6 * mm

    c.drawRightString(width - 20 * mm, y, fix_arabic(f"رقم الإيصال: TX-{transaction.id}"))
    y -= 6 * mm
    tx_date = getattr(transaction, "transaction_date", None) or getattr(transaction, "created_at", None)
    if tx_date:
        c.drawRightString(width - 20 * mm, y, fix_arabic(f"التاريخ: {tx_date.strftime('%Y-%m-%d %H:%M')}"))
        y -= 6 * mm

    c.drawRightString(width - 20 * mm, y, fix_arabic(f"الاتجاه: {transaction.direction}"))
    y -= 6 * mm
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"النوع: {transaction.type}"))
    y -= 6 * mm
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"طريقة الدفع: {transaction.payment_method or 'cash'}"))
    y -= 10 * mm

    c.setFont(font_name, 12)
    c.drawRightString(width - 20 * mm, y, fix_arabic(f"المبلغ: {float(transaction.amount):.2f} {currency}"))
    y -= 10 * mm

    c.setFont(font_name, 10)
    if getattr(transaction, "reference_no", None):
        c.drawRightString(width - 20 * mm, y, fix_arabic(f"المرجع: {transaction.reference_no}"))
        y -= 6 * mm
    if getattr(transaction, "notes", None):
        c.drawRightString(width - 20 * mm, y, fix_arabic(f"ملاحظات: {transaction.notes}"))
        y -= 6 * mm

    c.save()
    return str(file_path)
