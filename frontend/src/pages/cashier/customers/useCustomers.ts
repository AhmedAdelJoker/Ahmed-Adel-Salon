import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/core/utils";
import api from "@/services/api";
import {
  normalizeListResponse,
  normalizeItemResponse,
} from "@/services/apiAdapter";

const PAGE_SIZE = 10;
const EMPTY_FORM = { firstName: "", phone: "", notes: "" };

export const customerId = (c) => c?.customer_id || c?.customerId || c?.id;
export const customerName = (c) =>
  c?.first_name || c?.firstName || c?.name || "عميل مجهول";

export function validatePhone(phone) {
  const cleaned = phone.replace(/\s+/g, "");
  if (!cleaned) return "رقم الجوال مطلوب";
  if (!/^01[0-2,5]\d{8}$/.test(cleaned)) {
    return "رقم الجوال غير صحيح (يجب أن يبدأ بـ 01 ويكون 11 رقم)";
  }
  return null;
}

export function getTierLabel(customer) {
  return customer.current_tier || "برونزي";
}

export function getTierVariant(customer) {
  const value = String(customer.current_tier || "").toLowerCase();
  if (value.includes("gold") || value.includes("ذهبي")) return "warning";
  if (value.includes("silver") || value.includes("فضي")) return "secondary";
  return "outline";
}

export function useCustomers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("الكل");
   
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
   
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
   
  const fileInputRef = useRef<any>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * PAGE_SIZE;
      const response = await api.get("/customers", {
        params: { skip, limit: PAGE_SIZE, q: debouncedSearch },
      });
      const { items, total } = normalizeListResponse(response);
      setCustomers(items);
      setTotalCount(total || items.length);
    } catch (error) {
      console.error("Customers fetch error:", error);
      toast.error("فشل في تحميل بيانات العملاء");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await api.get("/customers/stats");
        setGlobalStats(response.data);
      } catch (err) {
        // Stats endpoint may not exist yet; fall back to local calculation
      }
    }
    fetchStats();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const visits = Number(customer.visits_count || 0);
      if (activeFilter === "VIP")
        return visits > 10 || customer.current_tier === "Gold";
      if (activeFilter === "منتظم") return visits >= 2 && visits <= 10;
      if (activeFilter === "جديد") return visits <= 1;
      return true;
    });
  }, [customers, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const customerStats = useMemo(() => {
    if (globalStats) {
      return {
        vipCount: globalStats.vip_count,
        newCount: globalStats.new_count,
        loyalCount: globalStats.loyal_count,
        totalSpend: globalStats.total_spend,
        totalPoints: globalStats.total_points,
        averageSpend: globalStats.average_spend,
      };
    }
    const vipCount = customers.filter((customer) => {
      const visits = Number(customer.visits_count || 0);
      const tier = String(customer.current_tier || "").toLowerCase();
      return visits > 10 || tier.includes("gold") || tier.includes("ذهبي");
    }).length;
    const newCount = customers.filter(
      (customer) => Number(customer.visits_count || 0) <= 1,
    ).length;
    const loyalCount = customers.filter(
      (customer) => Number(customer.visits_count || 0) >= 2,
    ).length;
    const totalSpend = customers.reduce(
      (sum, customer) => sum + Number(customer.lifetime_spend || 0),
      0,
    );
    const totalPoints = customers.reduce(
      (sum, customer) => sum + Number(customer.loyalty_points || 0),
      0,
    );
    return {
      vipCount,
      newCount,
      loyalCount,
      totalSpend,
      totalPoints,
      averageSpend: customers.length ? totalSpend / customers.length : 0,
    };
  }, [customers, globalStats]);

  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case "name":
          valA = customerName(a).toLowerCase();
          valB = customerName(b).toLowerCase();
          return sortOrder === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        case "phone":
          valA = a.phone || "";
          valB = b.phone || "";
          return sortOrder === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        case "visits":
          valA = Number(a.visits_count || 0);
          valB = Number(b.visits_count || 0);
          return sortOrder === "asc" ? valA - valB : valB - valA;
        case "spend":
          valA = Number(a.lifetime_spend || 0);
          valB = Number(b.lifetime_spend || 0);
          return sortOrder === "asc" ? valA - valB : valB - valA;
        case "created_at":
        default:
          valA = new Date(a.created_at || 0).getTime();
          valB = new Date(b.created_at || 0).getTime();
          return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [filteredCustomers, sortField, sortOrder]);

  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortOrder("desc");
      return field;
    });
  }, []);

  // Customer form state
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
   
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_FORM);

  // Delete state
   
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Details state
   
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
   
  const [customerAppointments, setCustomerAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
   
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState("appointments");
   
  const [expandedAppointment, setExpandedAppointment] = useState<any>(null);

  function closeCustomerForm() {
    setIsCustomerFormOpen(false);
    setEditingCustomer(null);
    setCustomerForm(EMPTY_FORM);
  }

  function openCreateCustomer() {
    setEditingCustomer(null);
    setCustomerForm(EMPTY_FORM);
    setIsCustomerFormOpen(true);
  }

  function openEditCustomer(customer) {
    setEditingCustomer(customer);
    setCustomerForm({
      firstName: customer.first_name || customer.firstName || "",
      phone: customer.phone || "",
      notes: customer.notes || "",
    });
    setIsCustomerFormOpen(true);
    setIsDetailsOpen(false);
  }

  async function handleCustomerFormSubmit() {
    const firstName = customerForm.firstName.trim();
    const phone = customerForm.phone.trim();
    if (!firstName) {
      toast.error("الاسم مطلوب");
      return;
    }

    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }

    const duplicateCustomer = customers.find(
      (c) => c.phone === phone && customerId(c) !== customerId(editingCustomer),
    );
    if (duplicateCustomer) {
      toast.error(
        `رقم الجوال مسجل مسبقاً للعميل: ${customerName(duplicateCustomer)}`,
      );
      return;
    }

    const payload = {
      first_name: firstName,
      firstName,
      last_name: "",
      lastName: "",
      phone,
      phone_normalized: phone.replace(/\s+/g, ""),
      notes: customerForm.notes.trim() || null,
    };

    try {
      setIsSavingCustomer(true);
      const id = customerId(editingCustomer);
      const response = id
        ? await api.put(`/customers/${id}`, payload)
        : await api.post("/customers", payload);
      toast.success(id ? "تم تحديث بيانات العميل" : "تمت إضافة العميل بنجاح");
      await fetchCustomers();
      closeCustomerForm();
      const saved = normalizeItemResponse(response, null);
      if (saved) openDetails(saved);
    } catch (error) {
      console.error("Customer save error:", error);
      toast.error(getApiErrorMessage(error, "فشل حفظ بيانات العميل"));
    } finally {
      setIsSavingCustomer(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await api.delete(`/customers/${customerId(deleteTarget)}`);
      toast.success("تم حذف العميل بنجاح");
      setDeleteTarget(null);
      await fetchCustomers();
    } catch (error) {
      console.error("Customer delete error:", error);
      toast.error("فشل في حذف العميل");
    } finally {
      setIsDeleting(false);
    }
  }

  const fetchCustomerAppointments = useCallback(async (custId) => {
    if (!custId) return;
    setLoadingAppointments(true);
    setExpandedAppointment(null);
    try {
      const response = await api.get("/appointments", {
        params: { customer_id: custId, limit: 50 },
      });
      const data = normalizeListResponse(response);
      setCustomerAppointments(data.items || []);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      setCustomerAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  const fetchCustomerInvoices = useCallback(async (custId) => {
    if (!custId) return;
    setLoadingInvoices(true);
    try {
      const response = await api.get("/invoices", {
        params: { customer_id: custId, limit: 10 },
      });
      const data = normalizeListResponse(response);
      setCustomerInvoices(data.items || data || []);
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setCustomerInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  const customerInsights = useMemo(() => {
    if (!selectedCustomer) return null;

     
    const barberCounts: Record<string, any> = {};
    customerAppointments.forEach((apt) => {
      if (apt.barber_name) {
        barberCounts[apt.barber_name] =
          (barberCounts[apt.barber_name] || 0) + 1;
      }
    });
    let topBarber = "غير محدد";
    let maxApts = 0;
    Object.entries(barberCounts).forEach(([name, count]) => {
      if (count > maxApts) {
        maxApts = count;
        topBarber = name;
      }
    });

    const totalApts = customerAppointments.length;
    const cancelledApts = customerAppointments.filter(
      (a) => a.status === "cancelled",
    ).length;
    const cancellationRate = totalApts
      ? Math.round((cancelledApts / totalApts) * 100)
      : 0;

    const totalSpent = Number(selectedCustomer.lifetime_spend || 0);
    const totalVisits = Number(selectedCustomer.visits_count || 0);
    const avgSpend = totalVisits ? totalSpent / totalVisits : 0;

     
    const sourceCounts: Record<string, any> = {};
    customerAppointments.forEach((apt) => {
      const src = apt.booking_source || "shop";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    let topSource = "المحل";
    let maxSrc = 0;
    Object.entries(sourceCounts).forEach(([src, count]) => {
      if (count > maxSrc) {
        maxSrc = count;
        topSource = src === "online" ? "أونلاين" : "المحل";
      }
    });

    return { topBarber, cancellationRate, avgSpend, topSource };
  }, [selectedCustomer, customerAppointments]);

  async function openDetails(customer) {
    const id = customerId(customer);
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
    setLoadingDetails(true);
    setActiveDetailsTab("appointments");
    fetchCustomerAppointments(id);
    fetchCustomerInvoices(id);

    try {
      const response = await api.get(`/customers/${id}`);
      const data = normalizeItemResponse(response, customer);
      if (data) {
        setSelectedCustomer(data);
      }
    } catch (error) {
      console.error("Failed to fetch customer details:", error);
    } finally {
      setLoadingDetails(false);
    }
  }

  return {
    // List state
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter,
    customers,
    loading,
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    sortedCustomers,
    customerStats,
    sortField,
    sortOrder,
    handleSort,
    fileInputRef,

    // Form state
    isCustomerFormOpen,
    setIsCustomerFormOpen,
    isSavingCustomer,
    editingCustomer,
    customerForm,
    setCustomerForm,
    openCreateCustomer,
    openEditCustomer,
    closeCustomerForm,
    handleCustomerFormSubmit,

    // Delete state
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,

    // Details state
    selectedCustomer,
    isDetailsOpen,
    setIsDetailsOpen,
    loadingDetails,
    openDetails,
    customerAppointments,
    loadingAppointments,
    customerInvoices,
    loadingInvoices,
    activeDetailsTab,
    setActiveDetailsTab,
    expandedAppointment,
    setExpandedAppointment,
    customerInsights,
  };
}
