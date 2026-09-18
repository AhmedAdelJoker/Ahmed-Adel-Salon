/**
 * Customers dialogs + form state (moved from Customers page, no logic changes).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { normalizeItemResponse } from "@/services/apiAdapter";
import { EMPTY_CUSTOMER_FORM } from "@/features/customers/constants";
import { customerId, customerName, secondPhone } from "@/features/customers/utils/customer";

export function useCustomerDialogs(
  fetchCustomers: () => Promise<void>,
  removeCustomer: (id: number | string) => void,
) {
  const navigate = useNavigate();
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
   
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
   
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        (document.querySelector('input[placeholder*="البحث"]') as HTMLElement)?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        openCreateCustomer();
      } else if (e.key === "Escape" && isDetailsOpen) setIsDetailsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDetailsOpen]);
  function openDetails(customer) {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
  }

  function closeCustomerForm() {
    setIsCustomerFormOpen(false);
    setEditingCustomer(null);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
  }

  function openCreateCustomer() {
    setEditingCustomer(null);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setIsCustomerFormOpen(true);
  }

  function openEditCustomer(customer) {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customerName(customer),
      phone: customer.phone || "",
      phone2: secondPhone(customer),
    });
    setIsCustomerFormOpen(true);
    setIsDetailsOpen(false);
  }
  async function handleCustomerFormSubmit() {
    const name = customerForm.name.trim();
    const phone = customerForm.phone.trim();
    if (!name || !phone) {
      toast.error("الاسم ورقم الجوال مطلوبان");
      return;
    }

    const [firstName, ...lastNameParts] = name.split(" ");
    const lastName = lastNameParts.join(" ");

    const payload = {
      first_name: firstName,
      firstName,
      last_name: lastName,
      lastName,
      phone,
      phone_normalized: phone.replace(/\s+/g, ""),
      phone2: customerForm.phone2?.trim() || null,
      alternate_phone: customerForm.phone2?.trim() || null,
      secondary_phone: customerForm.phone2?.trim() || null,
    };

    try {
      setIsSavingCustomer(true);
      const id = customerId(editingCustomer);
      let response;
      try {
        response = id
          ? await api.put(`/customers/${id}`, payload)
          : await api.post("/customers", payload);
      } catch (error) {
         
        const apiErr = error as { response?: { status?: number; data?: { detail?: unknown } } };
        if (apiErr?.response?.status !== 422 || !customerForm.phone2.trim())
          throw error;
         
        const fallbackPayload = { ...payload } as Record<string, any>;
        delete fallbackPayload.phone2;
        delete fallbackPayload.alternate_phone;
        delete fallbackPayload.secondary_phone;
        fallbackPayload.notes = [
          fallbackPayload.notes,
          `رقم إضافي: ${customerForm.phone2.trim()}`,
        ]
          .filter(Boolean)
          .join("\n");
        response = id
          ? await api.put(`/customers/${id}`, fallbackPayload)
          : await api.post("/customers", fallbackPayload);
      }
      toast.success(id ? "تم تحديث بيانات العميل" : "تمت إضافة العميل بنجاح");
      await fetchCustomers();
      closeCustomerForm();
      const saved = normalizeItemResponse(response, null);
      if (saved) openDetails(saved);
    } catch (error) {
      console.error("Customer save error:", error);
       
      const apiErr2 = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr2?.response?.data?.detail as string) || "فشل حفظ بيانات العميل");
    } finally {
      setIsSavingCustomer(false);
    }
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    const deletedId = customerId(deleteTarget);
    setDeleteTarget(null);
    removeCustomer(deletedId);
    try {
      await api.delete(`/customers/${deletedId}`);
      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            <span>تم نقل العميل إلى الأرشيف</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                navigate("/owner/customers/archive");
              }}
              className="shrink-0 font-black underline underline-offset-2"
            >
              عرض الأرشيف
            </button>
          </span>
        ),
        { duration: 6000 },
      );
    } catch (error) {
      console.error("Customer delete error:", error);
      toast.error("فشل في حذف العميل");
      fetchCustomers();
    }
  }

  return {
    selectedCustomer,
    isDetailsOpen,
    setIsDetailsOpen,
    setIsCustomerFormOpen,
    deleteTarget,
    setDeleteTarget,
    isCustomerFormOpen,
    isSavingCustomer,
    editingCustomer,
    customerForm,
    setCustomerForm,
    openDetails,
    closeCustomerForm,
    openCreateCustomer,
    openEditCustomer,
    handleCustomerFormSubmit,
    handleDelete,
  };
}
