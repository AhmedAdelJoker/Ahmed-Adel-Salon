/** Customer helpers (moved from Customers page, no logic changes). */
export function customerId(customer) {
    return customer?.customer_id || customer?.id || customer?.invoiceId;
  }

export function getInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

export function customerName(customer) {
    return (
      `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
      customer?.name ||
      "عميل"
    );
  }

export function secondPhone(customer) {
    return (
      customer?.phone2 ||
      customer?.alternate_phone ||
      customer?.secondary_phone ||
      null
    );
  }
