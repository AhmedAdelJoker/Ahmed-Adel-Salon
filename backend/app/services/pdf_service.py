from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm


BASE_DIR = Path(__file__).resolve().parents[2]
PDF_DIR = BASE_DIR / "generated_invoices"


def ensure_pdf_dir():
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    return PDF_DIR


def generate_invoice_pdf(invoice, items, customer, barber=None, shop_name="Salon Management Pro", shop_phone=None):
    """
    إنشاء PDF للفواتير وإرجاع المسار النهائي
    """
    ensure_pdf_dir()

    filename = f"invoice_{invoice.invoice_no}.pdf"
    file_path = PDF_DIR / filename

    c = canvas.Canvas(str(file_path), pagesize=A4)
    width, height = A4

    y = height - 20 * mm

    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, y, "Invoice / فاتورة")
    y -= 10 * mm

    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, y, f"Shop: {shop_name}")
    y -= 6 * mm
    if shop_phone:
        c.drawString(20 * mm, y, f"Phone: {shop_phone}")
        y -= 6 * mm

    c.drawString(20 * mm, y, f"Invoice No: {invoice.invoice_no}")
    y -= 6 * mm
    c.drawString(20 * mm, y, f"Date: {invoice.created_at.strftime('%Y-%m-%d %H:%M')}")
    y -= 10 * mm

    # Customer info
    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip()
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, "Customer")
    y -= 6 * mm

    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, y, f"Name: {customer_name}")
    y -= 6 * mm
    c.drawString(20 * mm, y, f"Phone: {customer.phone or '-'}")
    y -= 6 * mm

    if barber:
        c.drawString(20 * mm, y, f"Barber: {barber.display_name}")
        y -= 8 * mm
    else:
        y -= 2 * mm

    # Table Header
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Service")
    c.drawString(100 * mm, y, "Qty")
    c.drawString(125 * mm, y, "Unit Price")
    c.drawString(160 * mm, y, "Total")
    y -= 5 * mm

    c.line(20 * mm, y, 190 * mm, y)
    y -= 6 * mm

    # Items
    c.setFont("Helvetica", 10)
    for item in items:
        c.drawString(20 * mm, y, str(item.service_name))
        c.drawString(100 * mm, y, str(item.quantity))
        c.drawString(125 * mm, y, f"{float(item.unit_price):.2f}")
        c.drawString(160 * mm, y, f"{float(item.total_price):.2f}")
        y -= 6 * mm

        # لو الصفحة امتلأت
        if y < 30 * mm:
            c.showPage()
            y = height - 20 * mm
            c.setFont("Helvetica", 10)

    y -= 6 * mm
    c.line(20 * mm, y, 190 * mm, y)
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, f"Total Amount: {float(invoice.total_amount):.2f} EGP")

    y -= 15 * mm
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, y, "Thank you for your visit / شكرًا لزيارتكم")

    c.save()

    return str(file_path)