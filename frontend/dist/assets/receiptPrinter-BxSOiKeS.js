import{a as e}from"./rolldown-runtime-BYbx6iT9.js";import{n as t}from"./businessSettingsService-CkOzpRSp.js";var n=e(t(),1),r=e=>new Intl.NumberFormat(`ar-EG`,{style:`currency`,currency:`EGP`,maximumFractionDigits:2}).format(e||0),i=e=>e?new Date(e).toLocaleString(`ar-EG`,{dateStyle:`short`,timeStyle:`short`}):`-`,a=e=>e?String(e).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`):``,o=async(e,t={})=>{if(!e)return;let o=t.salon_name||t.salonName||`صالون برو`,s=t.shop_phone||t.shopPhone||``,c=t.shop_whatsapp||t.shopWhatsApp||``,l=t.address||t.shopAddress||``,u=t.logo_url||t.logoUrl||``,d=t.receipt_footer||t.receiptFooter||`شكراً لزيارتكم`,f=t.public_slug||`default-salon`,p=e.invoice_id||e.invoiceId||e.id||``,m=e.invoice_no||e.invoiceNo||e.number||p||`-`,h=e.customer_name||e.customerName||`عميل نقدي`,g=i(e.created_at||e.createdAt||new Date),_=(e.payment_method||e.paymentMethod||`cash`).toLowerCase(),v={cash:`نقدي`,card:`شبكة`,visa:`فيزا`,mada:`مدى`,wallet:`محفظة كاش`,instapay:`انستا باي`},y=(Array.isArray(e.items)?e.items:Array.isArray(e.invoice_items)?e.invoice_items:[]).map(e=>{let t=e.service_name||e.serviceName||e.product_name||e.productName||e.name||`بند`,n=Number(e.quantity||e.qty||1),i=Number(e.total_price||e.totalPrice||e.unit_price||e.price||0),o=e.barber_name||e.barberName||e.employee_name||e.employeeName||``;return`
      <tr>
        <td class="item-info">
          <div class="item-name">${a(t)}</div>
          ${o?`<div class="item-barber">خبير: ${a(o)}</div>`:``}
        </td>
        <td class="item-qty">${n}</td>
        <td class="item-total">${r(i)}</td>
      </tr>
    `}).join(``),b=Number(e.subtotal_amount||e.subtotalAmount||e.total_amount||0),x=Number(e.discount_amount||e.discountAmount||0),S=Number(e.total_amount||e.totalAmount||0),C=await n.toDataURL(`https://salon-pro.com/${f}?invoice=${m}`,{margin:1,width:120,color:{dark:`#111827`,light:`#ffffff`}}),w=`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>Receipt ${m}</title>
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
          ${u?`<img src="${u}" class="logo" />`:``}
          <div class="shop-name">${a(o)}</div>
          <div class="shop-info">
            ${s?`<div>ت: ${a(s)}</div>`:``}
            ${c?`<div>واتساب: ${a(c)}</div>`:``}
            ${l?`<div>${a(l)}</div>`:``}
          </div>
        </div>

        <div class="divider"></div>
        <div class="receipt-title">إيصال مبيعات</div>
        
        <div class="meta-row"><span class="meta-label">رقم الفاتورة:</span> <span>#${a(m)}</span></div>
        <div class="meta-row"><span class="meta-label">التاريخ:</span> <span>${a(g)}</span></div>
        <div class="meta-row"><span class="meta-label">العميل:</span> <span>${a(h)}</span></div>
        <div class="meta-row"><span class="meta-label">الدفع:</span> <span>${a(v[_]||_)}</span></div>

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
            ${y}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            <span>المجموع</span>
            <span>${r(b)}</span>
          </div>
          ${x>0?`
          <div class="total-row" style="color: #dc2626">
            <span>الخصم</span>
            <span>-${r(x)}</span>
          </div>`:``}
          <div class="total-row grand-total">
            <span>الصافي النهائي</span>
            <span>${r(S)}</span>
          </div>
        </div>

        <div class="qr-container">
          <img src="${C}" class="qr-code" />
          <div style="font-size: 8px; margin-top: 1mm">امسح للحجز أو التقييم</div>
        </div>

        <div class="footer">
          ${a(d)}
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
      <\/script>
    </body>
    </html>
  `,T=window.open(``,`_blank`,`width=420,height=720`);if(!T){alert(`يرجى السماح بالنوافذ المنبثقة للطباعة`);return}T.document.open(),T.document.write(w),T.document.close()};export{o as t};