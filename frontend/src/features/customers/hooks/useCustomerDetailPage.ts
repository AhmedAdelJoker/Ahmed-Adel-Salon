/**
 * Customer detail page state (moved from CustomerDetail page, no logic changes).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import {
  useCustomerActivityLogs,
  useCustomerAppointments,
  useCustomerDetail,
  useCustomerInvoices,
} from "@/hooks/useCustomer";
import { getTierInfo } from "@/features/customers/utils/customer";

export function useCustomerDetailPage(customerId: number) {
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
   
  const [editForm, setEditForm] = useState<any>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    phone2: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useCustomerDetail(customerId);
  const { data: appointments = [], isLoading: appointmentsLoading } =
    useCustomerAppointments(customerId);
  const { data: invoices = [], isLoading: invoicesLoading } =
    useCustomerInvoices(customerId);
  const { data: activityLogs = [], isLoading: activityLoading } =
    useCustomerActivityLogs(customerId);
  const tierInfo = getTierInfo(customer?.current_tier);
  const stats = useMemo(() => {
    if (!customer) return null;
    const totalSpend = Number(customer.lifetime_spend || 0);
    const visits = Number(customer.visits_count || 0);
    const points = Number(customer.loyalty_points || 0);
    const cancellations = Number(customer.cancellation_count || 0);
    const avgSpend = visits > 0 ? totalSpend / visits : 0;
    const noShowRate =
      visits > 0 ? Math.round((cancellations / visits) * 100) : 0;
    const paidInvoices = invoices.filter(
      (i) => i.status?.toUpperCase() === "PAID",
    );
    const totalPaid = paidInvoices.reduce(
      (sum, i) => sum + Number(i.total_amount || i.amount || 0),
      0,
    );
    const upcomingAppts = appointments.filter((a) =>
      ["PENDING", "CONFIRMED"].includes(a.status?.toUpperCase()),
    );
    return {
      totalSpend,
      visits,
      points,
      avgSpend,
      noShowRate,
      totalPaid,
      upcomingCount: upcomingAppts.length,
    };
  }, [customer, appointments, invoices]);

  function openEdit() {
    setEditForm({
      first_name: customer?.first_name || "",
      last_name: customer?.last_name || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      phone2: customer?.phone2 || customer?.alternate_phone || "",
      notes: customer?.notes || "",
    });
    setIsEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!editForm.first_name.trim() || !editForm.phone.trim()) {
      toast.error("الاسم والهاتف مطلوبان");
      return;
    }
    try {
      setIsSaving(true);
      const payload = { ...editForm };
      if (!payload.phone2?.trim()) delete payload.phone2;
      await api.put(`/customers/${customerId}`, payload);
      toast.success("تم تحديث بيانات العميل بنجاح");
      setIsEditOpen(false);
      window.location.reload();
    } catch (err) {
       
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr.response?.data?.detail as string) || "فشل تحديث البيانات");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/customers/${customerId}`);
      toast.success("تم حذف العميل بنجاح");
      navigate("/customers");
    } catch (err) {
      toast.error("فشل حذف العميل");
    }
  }

  return {
    customer,
    appointments,
    invoices,
    activityLogs,
    customerLoading,
    appointmentsLoading,
    invoicesLoading,
    activityLoading,
    customerError,
    tierInfo,
    stats,
    isEditOpen,
    setIsEditOpen,
    isDeleteOpen,
    setIsDeleteOpen,
    isBookingOpen,
    setIsBookingOpen,
    editForm,
    setEditForm,
    isSaving,
    openEdit,
    handleSaveEdit,
    handleDelete,
  };
}
