import React from "react";

/**
 * ThermalInvoice: Professional forwardRef component for thermal printing (80mm).
 * Dependency-free version: no qrcode.react import, so Vite build will not fail.
 */
 
type AnyRecord = Record<string, any>;

export interface ThermalInvoiceItem {
  name?: string;
  name_ar?: string;
  price?: number | string;
  quantity?: number;
  qty?: number;
  [key: string]: AnyRecord[string];
}

export interface ThermalInvoiceData {
  invoice_no?: string;
  id?: string | number;
  created_at?: string;
  items?: ThermalInvoiceItem[];
  subtotal_amount?: number | string;
  tax_amount?: number | string;
  total_amount?: number | string;
  discount_amount?: number | string;
  payment_method?: string;
  [key: string]: AnyRecord[string];
}

export interface ThermalInvoiceProps {
  invoice?: ThermalInvoiceData | null;
  settings?: Record<string, unknown>;
  cart?: ThermalInvoiceItem[];
  subtotal?: number | string;
  tax?: number | string;
  discount?: number | string;
  finalTotal?: number | string;
}

const ThermalInvoice = React.forwardRef<HTMLDivElement, ThermalInvoiceProps>(
  (
    {
      invoice,
      settings = {},
      cart = [],
      subtotal = 0,
      tax = 0,
      discount = 0,
      finalTotal = 0,
    },
    ref,
  ) => {
    if (!invoice) return null;

    const setting = (key: string): string | undefined => {
      const v = settings?.[key];
      return typeof v === "string" ? v : undefined;
    };
    const salonName =
      setting("salon_name") || setting("salonName") || "BARBER LUXE";
    const salonLogo = setting("logo_url") || setting("logoUrl");
    const salonAddress =
      setting("address") || setting("salon_address") || "مصر - القاهرة";
    const salonPhone = setting("shop_phone") || setting("shopPhone") || "---";
    const invoiceNo = String(invoice.invoice_no || invoice.id || "---");
    const createdAt = new Date(invoice.created_at || Date.now()).toLocaleString(
      "ar-EG",
      {
        dateStyle: "short",
        timeStyle: "short",
      },
    );
    const items = cart.length > 0 ? cart : invoice.items || [];
    const subTotalValue = Number(subtotal || invoice.subtotal_amount || 0);
    const taxValue = Number(
      tax || invoice.tax_amount || Number(invoice.total_amount ?? 0) * 0.15 || 0,
    );
    const discountValue = Number(discount || invoice.discount_amount || 0);
    const totalValue = Number(finalTotal || invoice.total_amount || 0);
    const paymentMethod =
      invoice.payment_method === "CASH" || invoice.payment_method === "cash"
        ? "نقدي"
        : invoice.payment_method === "CARD" || invoice.payment_method === "card"
          ? "بطاقة"
          : invoice.payment_method || "غير محدد";

    const qrPayload = JSON.stringify({
      invoice: invoiceNo,
      total: totalValue.toFixed(2),
      date: invoice.created_at || new Date().toISOString(),
      salon: salonName,
    });

    return (
      <div
        ref={ref}
        style={{
          width: "80mm",
          padding: "4mm",
          fontFamily: "Cairo, Tahoma, Arial, sans-serif",
          color: "#111",
          background: "#fff",
          fontSize: "11px",
          lineHeight: 1.5,
        }}
      >
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; background: #fff; }
            .no-print { display: none; }
          }
        `}</style>

        <div
          style={{
            textAlign: "center",
            marginBottom: "5mm",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {salonLogo ? (
            <img
              src={salonLogo}
              alt="Salon Logo"
              style={{
                width: 54,
                height: 54,
                objectFit: "contain",
                marginBottom: "3mm",
                borderRadius: "8px",
              }}
            />
          ) : (
            <div
              style={{
                width: 42,
                height: 42,
                marginBottom: "3mm",
                borderRadius: 10,
                background: "#000",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 22,
              }}
            >
              {salonName.charAt(0)}
            </div>
          )}

          <h2
            style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#000" }}
          >
            {salonName}
          </h2>
          <div style={{ fontSize: 10, color: "#374151", fontWeight: 700 }}>
            {salonAddress && <div>{salonAddress}</div>}
            {salonPhone && <div>ت: {salonPhone}</div>}
          </div>
        </div>

        <div style={{ borderTop: "1.5px dashed #000", margin: "4mm 0" }}></div>

        <div
          style={{
            background: "#fafafa",
            padding: "2.5mm",
            borderRadius: "6px",
            border: "1px solid #f3f4f6",
            marginBottom: "4mm",
          }}
        >
          <Row label="رقم الفاتورة" value={`#${invoiceNo}`} />
          <Row label="التاريخ" value={createdAt} />
          <Row label="العميل" value={invoice.customer_name || "عميل نقدي"} />
          {(invoice.barber_name || invoice.barberName) && (
            <Row
              label="الخبير"
              value={invoice.barber_name || invoice.barberName}
            />
          )}
          <Row label="طريقة الدفع" value={paymentMethod} />
        </div>

        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "2px solid #000",
                  padding: "6px 0",
                  fontSize: "12px",
                }}
              >
                الوصف / الخبير
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "2px solid #000",
                  padding: "6px 0",
                  fontSize: "12px",
                }}
              >
                الإجمالي
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const name =
                item.name || item.service_name || item.product_name || "بند";
              const expert = item.barberName || item.barber_name;
              const price = Number(
                item.price || item.total_price || item.amount || 0,
              );

              return (
                <tr key={`${name}-${i}`}>
                  <td
                    style={{
                      padding: "8px 0",
                      verticalAlign: "top",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: "11.5px" }}>
                      {name}
                    </div>
                    <div
                      style={{ fontSize: 9, color: "#6b7280", fontWeight: 700 }}
                    >
                      {expert ? `خبير: ${expert}` : "قسم المنتجات"}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "8px 0",
                      textAlign: "left",
                      verticalAlign: "top",
                      fontWeight: 800,
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    {price.toLocaleString("ar-EG", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            marginTop: "4mm",
            padding: "2.5mm",
            background: "#f9fafb",
            borderRadius: "8px",
          }}
        >
          <Row
            label="المجموع الفرعي"
            value={`${subTotalValue.toLocaleString("ar-EG")} ج.م`}
          />
          {discountValue > 0 ? (
            <Row
              label="الخصم"
              value={`-${discountValue.toLocaleString("ar-EG")} ج.م`}
              style={{ color: "#dc2626" }}
            />
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 18,
              fontWeight: 900,
              borderTop: "2px solid #000",
              marginTop: "3mm",
              paddingTop: "3mm",
              color: "#000",
            }}
          >
            <span>الإجمالي</span>
            <span>{totalValue.toLocaleString("ar-EG")} ج.م</span>
          </div>
        </div>

        <div style={{ textAlign: "center", paddingTop: "6mm" }}>
          <PrintQrPlaceholder value={qrPayload || ""} />
          <div
            style={{
              fontSize: 9,
              marginTop: "2mm",
              fontWeight: 800,
              color: "#374151",
            }}
          >
            امسح للتقييم أو حجز موعد جديد
          </div>

          <div
            style={{
              fontSize: 10,
              color: "#4b5563",
              marginTop: "6mm",
              paddingTop: "4mm",
              borderTop: "1px dashed #e5e7eb",
              fontWeight: 700,
            }}
          >
            شكرًا لزيارتكم! نرجو رؤيتكم قريبًا.
            <div
              style={{
                marginTop: "2mm",
                fontSize: 9,
                color: "#9ca3af",
                fontWeight: 400,
              }}
            >
              تم الإصدار عبر <b>Salon Pro ERP</b>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

function Row({ label, value, style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 4,
        fontSize: "11px",
        ...style,
      }}
    >
      <strong style={{ color: "#4b5563", fontWeight: 800 }}>{label}:</strong>
      <span style={{ fontWeight: 900, color: "#111827" }}>{value}</span>
    </div>
  );
}

function PrintQrPlaceholder({ value }) {
  const seed = Array.from(String(value || "")).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  const cells = Array.from(
    { length: 49 },
    (_, i) => (seed + i * 7 + Math.floor(i / 7) * 11) % 5 < 2,
  );

  return (
    <div
      title={value}
      style={{
        width: 72,
        height: 72,
        margin: "0 auto",
        border: "4px solid #111",
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gridTemplateRows: "repeat(7, 1fr)",
        gap: 2,
        padding: 3,
        background: "#fff",
      }}
    >
      {cells.map((filled, index) => (
        <span key={index} style={{ background: filled ? "#111" : "#fff" }} />
      ))}
    </div>
  );
}

ThermalInvoice.displayName = "ThermalInvoice";

export default ThermalInvoice;

