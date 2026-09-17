import { useMemo } from "react";
import { getInitials } from "@/lib/core/utils";

export function useCustomerHelpers(customers) {
  const customerId = useMemo(
    () => (customer) =>
      customer?.customer_id || customer?.customerId || customer?.id,
    [],
  );

  const customerName = useMemo(
    () => (customer) =>
      `${customer?.first_name || customer?.firstName || ""} ${customer?.last_name || customer?.lastName || ""}`.trim() ||
      customer?.name ||
      "عميل مجهول",
    [],
  );

  const secondPhone = useMemo(
    () => (customer) =>
      customer?.phone2 ||
      customer?.alternate_phone ||
      customer?.secondary_phone ||
      customer?.phone_2 ||
      "",
    [],
  );

  const getInitialsMemo = useMemo(() => (name) => getInitials(name), []);

  const duplicateGroups = useMemo(() => {
    const phoneMap = new Map();
    customers.forEach((c) => {
      const phone = String(c.phone || "").replace(/\s+/g, "");
      if (!phone) return;
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone).push(c);
    });
    return Array.from(phoneMap.values()).filter((group) => group.length > 1);
  }, [customers]);

  return {
    customerId,
    customerName,
    secondPhone,
    getInitials: getInitialsMemo,
    duplicateGroups,
  };
}
