import { useSalon } from '@/context/SalonContext';
import QRCode from 'qrcode';
import { useEffect } from 'react';
import React from "react";

/**
 * ThermalInvoice: Professional forwardRef component for thermal printing (80mm).
 * Dependency-free version: no qrcode.react import, so Vite build will not fail.
 */
const ThermalInvoice = React.forwardRef(
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

    const salonName =
      settings?.salon_name || settings?.salonName || "BARBER LUXE";
    const salonLogo = settings?.logo_url || settings?.logoUrl;
    const salonAddress =
      settings?.address || settings?.salon_address || "مصر - القاهرة";
    const salonPhone = settings?.shop_phone || settings?.shopPhone || "---";
    const invoiceNo = invoice.invoice_no || publicUrl || "---";
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
      tax || invoice.tax_amount || invoice.total_amount * 0.15 || 0,
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
        dir="rtl"
        style={{
          width: "80mm",
          padding: "4mm",
          fontFamily: "Cairo, Tahoma, Arial, sans-serif",
          color: "#111",
          background: "#fff",
          fontSize: "11px",
          lineHeight: 1.45,
        }}
      >
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; background: #fff; }
          }
        `}</style>

        <div
          style={{
            textAlign: "center",
            borderBottom: "1px dashed #111",
            paddingBottom: 8,
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
                margin: "0 auto 4px",
              }}
            />
          ) : (
            <div
              style={{
                width: 42,
                height: 42,
                margin: "0 auto 4px",
                borderRadius: 10,
                border: "1px solid #111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 22,
              }}
            >
              B
            </div>
          )}

          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>
            {salonName}
          </h2>
          <div>{salonAddress}</div>
          <div>ت: {salonPhone}</div>
        </div>

        <div style={{ borderBottom: "1px dashed #111", padding: "8px 0" }}>
          <Row label="رقم الفاتورة" value={invoiceNo || ""} />
          <Row label="التاريخ" value={createdAt || ""} />
          <Row label="العميل" value={invoice.customer_name || "عميل نقدي"} />
        </div>

        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "right",
                  borderBottom: "1px solid #111",
                  padding: "4px 0",
                }}
              >
                الخدمة / الوصف
              </th>
              <th
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #111",
                  padding: "4px 0",
                }}
              >
                السعر
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
                  <td style={{ padding: "5px 0", verticalAlign: "top" }}>
                    <div style={{ fontWeight: 800 }}>{name}</div>
                    <div style={{ fontSize: 10 }}>
                      {expert ? `خبير: ${expert}` : "قسم المنتجات"}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "5px 0",
                      textAlign: "left",
                      verticalAlign: "top",
                    }}
                  >
                    {price.toLocaleString("ar-EG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{ borderTop: "1px dashed #111", marginTop: 8, paddingTop: 8 }}
        >
          <Row
            label="المجموع"
            value={`${subTotalValue.toFixed(2) || ""} ج.م`}
          />
          {discountValue > 0 ? (
            <Row label="الخصم" value={`-${discountValue.toFixed(2) || ""} ج.م`} />
          ) : null}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              fontSize: 14,
              fontWeight: 900,
              borderTop: "1px solid #111",
              marginTop: 6,
              paddingTop: 6,
            }}
          >
            <span>الإجمالي</span>
            <span>{totalValue.toFixed(2)} ج.م</span>
          </div>
        </div>

        <div style={{ textAlign: "center", paddingTop: 10 }}>
          <PrintQrPlaceholder value={qrPayload || ""} />
          <div style={{ marginTop: 6 }}>طريقة الدفع: {paymentMethod}</div>
          <strong>شكرًا لزيارتكم! نرجو رؤيتكم قريبًا.</strong>
          <div style={{ fontSize: 10, marginTop: 4 }}>
            نظام صالون برو - لإدارة الصالونات الاحترافية
          </div>
          <div style={{ marginTop: 8 }}>
            ------------------------------------------------
          </div>
        </div>
      </div>
    );
  },
);

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        marginBottom: 4,
      }}
    >
      <strong>{label}:</strong>
      <span>{value}</span>
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
