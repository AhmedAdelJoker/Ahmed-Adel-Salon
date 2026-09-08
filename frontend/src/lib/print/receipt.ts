import QRCode from "qrcode";

/**
 * Professional Thermal Receipt Printer Utility
 * Supports 80mm and 58mm layouts, Cairo font, and real QR codes.
 */

const formatCurrency = (value: unknown): string => {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format((value as number) || 0);
};

const formatDate = (date: unknown): string => {
  if (!date) return "-";
  return new Date(date as string | number | Date).toLocaleString("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const escapeHtml = (str: unknown): string => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const printThermalReceipt = async (invoice: Record<string, any> | null | undefined, settings: Record<string, any> = {}): Promise<void> => {
  if (!invoice) return;

  const shopName = settings.salon_name || settings.salonName || "صالون برو";
  const shopPhone = settings.shop_phone || settings.shopPhone || "";
  const shopWhatsApp = settings.shop_whatsapp || settings.shopWhatsApp || "";
  const address = settings.address || settings.shopAddress || "";
  const logoUrl = settings.logo_url || settings.logoUrl || "";
  const footer =
    settings.receipt_footer || settings.receiptFooter || "شكراً لزيارتكم";
  const publicSlug = settings.public_slug || "default-salon";

  const invoiceId = invoice.invoice_id || invoice.invoiceId || invoice.id || "";
  const invoiceNo =
    invoice.invoice_no ||
    invoice.invoiceNo ||
    invoice.number ||
    invoiceId ||
    "-";
  const customerName =
    invoice.customer_name || invoice.customerName || "عميل نقدي";
  const createdAt = formatDate(
    invoice.created_at || invoice.createdAt || new Date(),
  );
  const paymentMethod = (
    invoice.payment_method ||
    invoice.paymentMethod ||
    "cash"
  ).toLowerCase();

  const paymentLabels: Record<string, string> = {
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

  const itemsHtml = rows
    .map((item: Record<string, any>) => {
      const name =
        item.service_name ||
        item.serviceName ||
        item.product_name ||
        item.productName ||
        item.name ||
        "بند";
      const qty = Number(item.quantity || item.qty || 1);
      const price = Number(
        item.total_price ||
          item.totalPrice ||
          item.unit_price ||
          item.price ||
          0,
      );
      const barber =
        item.barber_name ||
        item.barberName ||
        item.employee_name ||
        item.employeeName ||
        "";

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
    })
    .join("");

  const subtotal = Number(
    invoice.subtotal_amount ||
      invoice.subtotalAmount ||
      invoice.total_amount ||
      0,
  );
  const discount = Number(
    invoice.discount_amount || invoice.discountAmount || 0,
  );
  const total = Number(invoice.total_amount || invoice.totalAmount || 0);

  // Generate real QR Code
  const qrDataUrl = await QRCode.toDataURL(
    `https://salon-pro.com/${publicSlug}?invoice=${invoiceNo}`,
    {
      margin: 1,
      width: 120,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    },
  );

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
          line-height: 1.5;
        }

        .container {
          width: 72mm;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 5mm;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .logo {
          width: 35mm;
          height: 35mm;
          margin-bottom: 3mm;
          object-fit: contain;
          border-radius: 8mm;
        }

        .shop-name {
          font-size: 19px;
          font-weight: 900;
          margin: 1mm 0;
          color: #000;
          letter-spacing: -0.5px;
        }

        .shop-info {
          font-size: 10px;
          color: #374151;
          font-weight: 700;
        }

        .divider {
          border-top: 1.5px dashed #000;
          margin: 4mm 0;
        }

        .receipt-title {
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          margin: 3mm 0;
          background: #f3f4f6;
          padding: 1.5mm;
          border-radius: 2mm;
          border: 1px solid #e5e7eb;
        }

        .meta-section {
          background: #fafafa;
          padding: 2mm;
          border-radius: 2mm;
          border: 1px solid #f3f4f6;
          margin-bottom: 3mm;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.8mm;
        }

        .meta-label { font-weight: 800; color: #4b5563; }
        .meta-value { font-weight: 900; color: #111827; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 4mm 0;
        }

        th {
          border-bottom: 2px solid #000;
          padding: 2mm 0;
          font-weight: 900;
          text-align: right;
          font-size: 12px;
        }

        td {
          padding: 2.5mm 0;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: top;
        }

        .item-info { width: 55%; }
        .item-name { font-weight: 800; font-size: 11.5px; color: #000; }
        .item-barber { font-size: 9px; color: #6b7280; font-weight: 700; margin-top: 0.5mm; }
        .item-qty { width: 10%; text-align: center; font-weight: 700; }
        .item-total { width: 35%; text-align: left; font-weight: 800; font-size: 11px; }

        .total-section {
          margin-top: 3mm;
          padding: 2mm;
          background: #f9fafb;
          border-radius: 3mm;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 1.5mm 0;
          font-size: 12px;
          font-weight: 700;
        }

        .grand-total {
          border-top: 2px solid #000;
          margin-top: 2.5mm;
          padding-top: 3mm;
          font-size: 18px;
          font-weight: 900;
          color: #000;
        }

        .qr-container {
          text-align: center;
          margin: 6mm 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qr-code {
          width: 38mm;
          height: 38mm;
          padding: 1.5mm;
          border: 1px solid #e5e7eb;
          border-radius: 4mm;
          background: #fff;
        }

        .footer {
          text-align: center;
          font-size: 10px;
          color: #4b5563;
          margin-top: 5mm;
          padding-top: 3mm;
          border-top: 1px dashed #e5e7eb;
          font-weight: 700;
        }

        @media print {
          body { width: 80mm; }
          .container { width: 72mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${
            logoUrl
              ? `<img src="${logoUrl}" class="logo" />`
              : `
            <div style="width: 25mm; height: 25mm; background: #000; color: #fff; border-radius: 6mm; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 900; margin-bottom: 3mm;">
              ${shopName.charAt(0)}
            </div>
          `
          }
          <div class="shop-name">${escapeHtml(shopName)}</div>
          <div class="shop-info">
            ${shopPhone ? `<div>ت: ${escapeHtml(shopPhone)}</div>` : ""}
            ${shopWhatsApp ? `<div>واتساب: ${escapeHtml(shopWhatsApp)}</div>` : ""}
            ${address ? `<div>${escapeHtml(address)}</div>` : ""}
          </div>
        </div>

        <div class="divider"></div>
        <div class="receipt-title">إيصال مبيعات احترافي</div>
        
        <div class="meta-section">
          <div class="meta-row"><span class="meta-label">رقم الفاتورة:</span> <span class="meta-value">#${escapeHtml(invoiceNo)}</span></div>
          <div class="meta-row"><span class="meta-label">التاريخ:</span> <span class="meta-value">${escapeHtml(createdAt)}</span></div>
          <div class="meta-row"><span class="meta-label">العميل:</span> <span class="meta-value">${escapeHtml(customerName)}</span></div>
          <div class="meta-row"><span class="meta-label">طريقة الدفع:</span> <span class="meta-value">${escapeHtml(paymentLabels[paymentMethod] || paymentMethod)}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>الوصف / الخبير</th>
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
            <span>المجموع الفرعي</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${
            discount > 0
              ? `
          <div class="total-row" style="color: #dc2626">
            <span>الخصم المطبق</span>
            <span>-${formatCurrency(discount)}</span>
          </div>`
              : ""
          }
          <div class="total-row grand-total">
            <span>الإجمالي الصافي</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>

        <div class="qr-container">
          <img src="${qrDataUrl}" class="qr-code" />
          <div style="font-size: 9px; margin-top: 2mm; font-weight: 800; color: #374151">امسح للتقييم أو حجز موعد جديد</div>
        </div>

        <div class="footer">
          ${escapeHtml(footer)}
          <div style="margin-top: 3mm; font-size: 9px; color: #9ca3af; font-weight: 400">
            شكرًا لثقتكم بنا. ننتظر زيارتكم القادمة!
            <br/>
            تم الإصدار عبر <b>Salon Pro ERP</b>
          </div>
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
