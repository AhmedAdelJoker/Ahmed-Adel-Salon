import { useEffect, useState, useMemo, useCallback } from "react";
import api from "@/services/api";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useSalon } from "@/context/SalonContext";
import { printThermalReceipt } from "@/lib/print/receipt";
import { toast } from "react-hot-toast";

export function useCashierDashboard() {
  const { user } = useAuth();
  const { settings } = useSalon();
  const { socket } = (useSocket() as any);

  const [summary, setSummary] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [viewInvoice, setViewInvoice] = useState<any>({ open: false, data: null });
  const [adjInvoice, setAdjInvoice] = useState<any>({ open: false, data: null });
  const [adjForm, setAdjForm] = useState<any>({
    type: "discount",
    reason: "",
    newValue: "",
  });
  const [submittingAdj, setSubmittingAdj] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [summaryData, todayInvoicesRes] = await Promise.all([
        dashboardService.cashierSummary(),
        api.get("/invoices/today"),
      ]);
      setSummary(summaryData);
      setRecentInvoices(todayInvoicesRes.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      if (!isRefresh) setError("تعذر تحميل بيانات لوحة التحكم");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          msg.event === "invoice_created" ||
          msg.event === "appointment_ready_for_payment" ||
          msg.event === "appointment_status_changed"
        ) {
          loadData(true);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };
    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, loadData]);

  const filteredTodayInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return recentInvoices;
    return recentInvoices.filter(
      (inv) =>
        (inv.invoice_no || "").toLowerCase().includes(term) ||
        (inv.customer_name || "").toLowerCase().includes(term) ||
        (inv.barber_name || "").toLowerCase().includes(term),
    );
  }, [recentInvoices, searchTerm]);

  const handleViewInvoice = (invoice) => {
    setViewInvoice({ open: true, data: invoice });
  };

  const handlePrintInvoice = async (invoice) => {
    try {
      await printThermalReceipt(invoice, settings);
      toast.success("تم إرسال الفاتورة للطابعة");
    } catch (err) {
      console.error(err);
      toast.error("فشل في طباعة الفاتورة");
    }
  };

  const handleRequestAdjustment = (invoice) => {
    setAdjInvoice({ open: true, data: invoice });
    setAdjForm({ type: "discount", reason: "", newValue: "" });
  };

  const submitAdjustment = async () => {
    if (!adjForm.reason) return toast.error("يرجى ذكر سبب التعديل");
    setSubmittingAdj(true);
    try {
      const payload = {
        request_type: adjForm.type,
        reason: adjForm.reason,
        notes: "",
        requested_values:
          adjForm.type === "void"
            ? { status: "cancelled" }
            : { new_value: adjForm.newValue },
      };
      await api.post(
        `/invoices/${adjInvoice.data.id}/adjustment-requests`,
        payload,
      );
      toast.success("تم إرسال طلب التعديل بنجاح");
      setAdjInvoice({ open: false, data: null });
      loadData();
    } catch (_err) {
      toast.error("فشل في إرسال الطلب");
    } finally {
      setSubmittingAdj(false);
    }
  };

  return {
    user,
    summary,
    recentInvoices,
    filteredTodayInvoices,
    loading,
    refreshing,
    error,
    searchTerm,
    setSearchTerm,
    lastRefresh,
    viewInvoice,
    setViewInvoice,
    adjInvoice,
    setAdjInvoice,
    adjForm,
    setAdjForm,
    submittingAdj,
    loadData,
    handleViewInvoice,
    handlePrintInvoice,
    handleRequestAdjustment,
    submitAdjustment,
  };
}
