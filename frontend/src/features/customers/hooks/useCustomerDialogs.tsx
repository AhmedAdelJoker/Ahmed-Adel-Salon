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
import { useTranslation } from "react-i18next";

export function useCustomerDialogs(
  fetchCustomers: () => Promise<void>,
  removeCustomer: (id: number | string) => void,
) {
  const navigate = useNavigate();
  const { t } = useTranslation("customers");
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
      if (e.key === "Escape" && isDetailsOpen) setIsDetailsOpen(false);
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
      toast.error(t("toasts.namePhoneRequired"));
      return;
    }

    const [firstName, ...lastNameParts] = name.split(" ");
    const lastName = lastNameParts.join(" ");

    // Preserve the fields the quick form doesn't show so PUT doesn't wipe them.
    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone,
      second_phone: customerForm.phone2?.trim() || null,
      email: editingCustomer?.email || null,
      notes: editingCustomer?.notes || null,
    };

    try {
      setIsSavingCustomer(true);
      const id = customerId(editingCustomer);
      const response = id
        ? await api.put(`/customers/${id}`, payload)
        : await api.post("/customers", payload);
      toast.success(id ? t("toasts.updateSuccess") : t("toasts.saveSuccess"));
      await fetchCustomers();
      closeCustomerForm();
      const saved = normalizeItemResponse(response, null);
      if (saved) openDetails(saved);
    } catch (error) {
      console.error("Customer save error:", error);
       
      const apiErr2 = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr2?.response?.data?.detail as string) || t("toasts.saveFailed"));
    } finally {
      setIsSavingCustomer(false);
    }
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    const deletedId = customerId(deleteTarget);
    const archiveReason = `${customerName(deleteTarget)} — ${t("toasts.deleteSuccess")}`;
    setDeleteTarget(null);
    removeCustomer(deletedId);
    try {
      await api.delete(`/customers/${deletedId}`, {
        data: { archive_reason: archiveReason },
      });
      toast.success(
        (toastObj) => (
          <span className="flex items-center gap-3">
            <span>{t("toasts.deleteSuccess")}</span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(toastObj.id);
                navigate("/owner/customers/archive");
              }}
              className="shrink-0 font-black underline underline-offset-2"
            >
              {t("toasts.viewArchive")}
            </button>
          </span>
        ),
        { duration: 6000 },
      );
    } catch (error) {
      console.error("Customer delete error:", error);
      toast.error(t("toasts.deleteFailed"));
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
