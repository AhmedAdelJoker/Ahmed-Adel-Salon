import QRCode from "qrcode";

/**
 * Professional Thermal Receipt Printer Utility
 * Supports 80mm and 58mm layouts, Cairo font, and real QR codes.
 */

const formatCurrency = (value) => {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(value || 0);
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const escapeHtml = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const printThermalReceipt = async (invoice, settings = {}) => {
  if (!invoice) return;

  const shopName = settings.salon_name || settings.salonName || "صالون برو";
  const shopPhone = settings.shop_phone || settings.shopPhone || "";
  const shopWhatsApp = settings.shop_whatsapp || settings.shopWhatsApp || "";
  const address = settings.address || settings.shopAddress || "";
  const logoUrl = settings.logo_url || settings.logoUrl || "";
  const footer = settings.receipt_footer || settings.receiptFooter || "شكراً لزيارتكم";
  const publicSlug = settings.public_slug || "default-salon";

  const invoiceId = invoice.invoice_id || invoice.invoiceId || invoice.id || "";
  const invoiceNo = invoice.invoice_no || invoice.invoiceNo || invoice.number || invoiceId || "-";
  const customerName = invoice.customer_name || invoice.customerName || "عميل نقدي";
  const createdAt = formatDate(invoice.created_at || invoice.createdAt || new Date());
  const paymentMethod = (invoice.payment_method || invoice.paymentMethod || "cash").toLowerCase();
  
  const paymentLabels = {
    cash: "نقدي",
    card: "شبكة",
    visa: "فيزا",
    mada: "مدى",
    wallet: "محفظة كاش",
    instapay: "انستا باي",
  };

  const rows = Array.isArray(invoice.items) 
    ? invoice.items 
    : Array.isArray(invoice.invoice_items) 
      ? invoice.invoice_items 
      : [];

  const itemsHtml = rows.map(item => {
    const name = item.service_name || item.serviceName || item.product_name || item.productName || item.name || "بند";
    const qty = Number(item.quantity || item.qty || 1);
    const price = Number(item.total_price || item.totalPrice || item.unit_price || item.price || 0);
    const barber = item.barber_name || item.barberName || item.employee_name || item.employeeName || "";

    return `
      <tr>
        <td class="item-info">
          <div class="item-name">${escapeHtml(name)}</div>
          ${barber ? `<div class="item-barber">خبير: ${escapeHtml(barber)}</div>` : ""}
        </td>
        <td class="item-qty">${qty}</td>
        <td class="item-total">${formatCurrency(price)}</td>
      </tr>
    `;
  }).join("");

  const subtotal = Number(invoice.subtotal_amount || invoice.subtotalAmount || invoice.total_amount || 0);
  const discount = Number(invoice.discount_amount || invoice.discountAmount || 0);
  const total = Number(invoice.total_amount || invoice.totalAmount || 0);

  // Generate real QR Code
  const qrDataUrl = await QRCode.toDataURL(`https://salon-pro.com/${publicSlug}?invoice=${invoiceNo}`, {
    margin: 1,
    width: 120,
    color: {
      dark: '#111827',
      light: '#ffffff'
    }
  });

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${invoiceNo}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        
        @page {
          size: 80mm auto;
          margin: 0;
        }

        body {
          font-family: 'Cairo', sans-serif;
          width: 80mm;
          margin: 0;
          padding: 4mm;
          background: #fff;
          color: #111827;
          font-size: 11px;
          line-height: 1.4;
        }

        .container {
          width: 72mm;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 4mm;
        }

        .logo {
          max-width: 30mm;
          max-height: 30mm;
          margin-bottom: 2mm;
          object-fit: contain;
        }

        .shop-name {
          font-size: 16px;
          font-weight: 900;
          margin: 1mm 0;
        }

        .shop-info {
          font-size: 10px;
          color: #4b5563;
        }

        .divider {
          border-top: 1px dashed #111827;
          margin: 3mm 0;
        }

        .receipt-title {
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          margin: 2mm 0;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5mm;
        }

        .meta-label { font-weight: 700; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 3mm 0;
        }

        th {
          border-bottom: 1px solid #111827;
          padding: 1.5mm 0;
          font-weight: 900;
          text-align: right;
        }

        td {
          padding: 2mm 0;
          border-bottom: 1px dashed #e5e7eb;
          vertical-align: top;
        }

        .item-info { width: 55%; }
        .item-name { font-weight: 700; }
        .item-barber { font-size: 9px; color: #6b7280; }
        .item-qty { width: 10%; text-align: center; }
        .item-total { width: 35%; text-align: left; font-weight: 700; }

        .total-section {
          margin-top: 2mm;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 1mm 0;
          font-size: 12px;
        }

        .grand-total {
          border-top: 1px solid #111827;
          margin-top: 2mm;
          padding-top: 2mm;
          font-size: 15px;
          font-weight: 900;
        }

        .qr-container {
          text-align: center;
          margin: 5mm 0;
        }

        .qr-code {
          width: 35mm;
          height: 35mm;
        }

        .footer {
          text-align: center;
          font-size: 10px;
          color: #4b5563;
          margin-top: 4mm;
        }

        @media print {
          body { width: 80mm; }
          .container { width: 72mm; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ""}
          <div class="shop-name">${escapeHtml(shopName)}</div>
          <div class="shop-info">
            ${shopPhone ? `<div>ت: ${escapeHtml(shopPhone)}</div>` : ""}
            ${shopWhatsApp ? `<div>واتساب: ${escapeHtml(shopWhatsApp)}</div>` : ""}
            ${address ? `<div>${escapeHtml(address)}</div>` : ""}
          </div>
        </div>

        <div class="divider"></div>
        <div class="receipt-title">إيصال مبيعات</div>
        
        <div class="meta-row"><span class="meta-label">رقم الفاتورة:</span> <span>#${escapeHtml(invoiceNo)}</span></div>
        <div class="meta-row"><span class="meta-label">التاريخ:</span> <span>${escapeHtml(createdAt)}</span></div>
        <div class="meta-row"><span class="meta-label">العميل:</span> <span>${escapeHtml(customerName)}</span></div>
        <div class="meta-row"><span class="meta-label">الدفع:</span> <span>${escapeHtml(paymentLabels[paymentMethod] || paymentMethod)}</span></div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th>البند</th>
              <th style="text-align: center">ك</th>
              <th style="text-align: left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span>المجموع</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${discount > 0 ? `
          <div class="total-row" style="color: #dc2626">
            <span>الخصم</span>
            <span>-${formatCurrency(discount)}</span>
          </div>` : ""}
          <div class="total-row grand-total">
            <span>الصافي النهائي</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>

        <div class="qr-container">
          <img src="${qrDataUrl}" class="qr-code" />
          <div style="font-size: 8px; margin-top: 1mm">امسح للحجز أو التقييم</div>
        </div>

        <div class="footer">
          ${escapeHtml(footer)}
          <div style="margin-top: 2mm; font-size: 8px">تم الإصدار عبر نظام صالون برو</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=420,height=720");
  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة للطباعة");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
