import { useAuth } from "@/context/AuthContext";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  History,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  FileDown,
  FileUp,
  Eye,
  Archive,
} from "lucide-react";
import api from "@/services/api";
import {
  normalizeListResponse,
  normalizeItemResponse,
} from "@/services/apiAdapter";
import { exportService } from "@/services/exportService";
import { importService } from "@/services/importService";
import { Button, Card, Badge, Input } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import SkeletonCard from "@/components/shared/SkeletonCard";
import { SkeletonBlock } from "@/components/shared/SkeletonBlock";

const EMPTY_CUSTOMER_FORM = {
  name: "",
  phone: "",
  phone2: "",
};
const pageSize = 10;

export default function Customers() {
  return (
    <ErrorBoundary>
      <CustomersInner />
    </ErrorBoundary>
  );
}

function CustomersInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";
  const isManagerOrOwner =
    isOwner || user?.role === "manager" || user?.role === "accountant";

  function customerId(customer) {
    return customer?.customer_id || customer?.id || customer?.invoiceId;
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  function customerName(customer) {
    return (
      `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
      customer?.name ||
      "عميل"
    );
  }

  function secondPhone(customer) {
    return (
      customer?.phone2 ||
      customer?.alternate_phone ||
      customer?.secondary_phone ||
      null
    );
  }

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'table'
   
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
   
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
   
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
   
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
   
  const fileInputRef = useRef<any>(null);

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

  async function handleExport(type = "excel") {
    const filename = `customers_${new Date().toISOString().split("T")[0]}`;
    if (type === "excel") {
      await exportService.downloadExcel("/exports/customers/excel", filename, {
        q: debouncedSearch,
      });
    } else {
      await exportService.downloadCsv("/exports/customers/csv", filename, {
        q: debouncedSearch,
      });
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importService.importCustomers(file);
      await fetchCustomers();
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
      const skip = (currentPage - 1) * pageSize;
      const response = await api.get("/customers", {
        params: { skip, limit: pageSize, q: debouncedSearch },
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

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const visits = Number(customer.visits_count || customer.visits || 0);
      if (activeFilter === "VIP") return visits > 10;
      if (activeFilter === "منتظم") return visits >= 2 && visits <= 10;
      if (activeFilter === "جديد") return visits <= 1;
      return true;
    });
  }, [customers, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
    setCustomers((prev) => prev.filter((c) => customerId(c) !== deletedId));
    try {
      await api.delete(`/customers/${deletedId}`);
      toast.success("تم حذف العميل بنجاح");
    } catch (error) {
      console.error("Customer delete error:", error);
      toast.error("فشل في حذف العميل");
      fetchCustomers();
    }
  }

  if (loading && customers.length === 0) {
    return (
      <div className="erp-page-container space-y-6 pb-6 sm:space-y-8" dir="rtl">
        <div className="page-header">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-gray-50 sm:text-4xl">
              سجل العملاء
            </h1>
            <p className="page-subtitle mt-2">
              إدارة قاعدة البيانات وبناء علاقات ولاء مستدامة
            </p>
          </div>
        </div>

        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Skeleton Table */}
        <Card className="border-border p-4 shadow-sm">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <SkeletonBlock className="h-11 w-11 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-1/4" />
                  <SkeletonBlock className="h-3 w-1/3" />
                </div>
                <SkeletonBlock className="h-6 w-20 shrink-0" />
                <SkeletonBlock className="h-6 w-24 shrink-0" />
                <SkeletonBlock className="h-8 w-24 shrink-0" />
              </div>
            ))}
          </div>
        </Card>

        {/* Skeleton Pagination */}
        <div className="flex flex-col gap-3 border-t border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
          <SkeletonBlock className="h-4 w-32" />
          <div className="flex items-center justify-center gap-3 sm:justify-end">
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
            <SkeletonBlock className="h-8 w-16 rounded-xl" />
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-6 sm:space-y-8" dir="rtl">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-gray-50 sm:text-4xl">
            سجل العملاء
          </h1>
          <p className="page-subtitle mt-2">
            إدارة قاعدة البيانات وبناء علاقات ولاء مستدامة
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
            accept=".csv, .xlsx, .xls"
          />
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="h-12 w-full px-6 border-black/10 dark:border-white/10 sm:w-auto"
          >
            <FileUp size={18} className="ml-2" /> استيراد
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => handleExport("excel")}
            className="h-12 w-full px-6 border-black/10 dark:border-white/10 sm:w-auto"
          >
            <FileDown size={18} className="ml-2" /> تصدير
          </Button>
          {isManagerOrOwner && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => navigate("/owner/customers/archive")}
              className="h-12 w-full px-6 border-black/10 dark:border-white/10 sm:w-auto"
            >
              <Archive size={18} className="ml-2" /> الأرشيف
            </Button>
          )}
          <Button
            disabled={loading}
            onClick={openCreateCustomer}
            className="h-12 w-full px-8 text-base sm:w-auto"
          >
            <Plus size={20} className="ml-2" /> إضافة عميل
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="إجمالي المنظومة"
          value={totalCount || ""}
          icon={Users}
          color="bg-[#6D28D9]"
        />
        <Kpi
          label="نخبة VIP"
          value={
            customers.filter(
              (customer) =>
                Number(customer.visits_count || customer.visits || 0) > 10,
            ).length || ""
          }
          icon={Star}
          color="bg-amber-500"
        />
        <Kpi
          label="العملاء الجدد"
          value={
            customers.filter(
              (customer) =>
                Number(customer.visits_count || customer.visits || 0) <= 1,
            ).length || ""
          }
          icon={UserPlus}
          color="bg-emerald-600"
        />
        <Kpi
          label="متوسط الإنفاق"
          value={
            formatCurrency(
              customers.length > 0
                ? customers.reduce(
                    (sum, c) =>
                      sum +
                      Number(
                        c.lifetime_spend || c.total_spend || c.totalSpend || 0,
                      ),
                    0,
                  ) / customers.length
                : 0,
            ) || ""
          }
          icon={TrendingUp}
          color="bg-blue-600"
        />
      </div>

      {duplicateGroups.length > 0 && (
        <div
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Users size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-main">
                تم اكتشاف {duplicateGroups.length} مجموعة من العملاء المكررين
              </p>
              <p className="text-[10px] font-bold text-muted">
                عملاء لهم نفس رقم الهاتف - يمكن دمجهم
              </p>
            </div>
            <span className="text-xs font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-lg">
              {duplicateGroups.reduce((sum, g) => sum + g.length, 0)} سجل
            </span>
          </div>
        </div>
      )}

      <Card className="border-border p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="chip-scroller">
            {["الكل", "VIP", "منتظم", "جديد"].map((tab) => (
              <button
                type="button"
                key={tab}
                disabled={loading}
                onClick={() => setActiveFilter(tab)}
                className={`whitespace-nowrap rounded-xl px-8 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === tab ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:bg-sky-400 dark:text-slate-950" : "bg-slate-50 text-slate-400 hover:bg-slate-100 bg-soft dark:text-slate-500"}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="البحث بالاسم أو رقم الجوال..."
              className="pr-11 h-12 rounded-xl bg-slate-50 border-none font-bold"
              value={searchTerm || ""}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-soft p-1 border border-border/40">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                viewMode === "cards"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-main",
              )}
              title="عرض بطاقات"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                viewMode === "table"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-main",
              )}
              title="عرض جدول"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
            </button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-none bg-transparent shadow-none lg:border lg:bg-card lg:shadow-sm">
        {/* Table View */}
        {viewMode === "table" && (
          <div className="overflow-x-auto">
            <table className="min-w-[52rem] w-full text-right">
              <thead>
                <tr className="border-b border-black/5 bg-gray-50 dark:border-white/10 bg-soft">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    ملف العميل
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    رقم التواصل
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    الزيارات
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                    الإنفاق
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {filteredCustomers.map((customer, index) => (
                  <tr
                    key={customerId(customer) || index}
                    className={`cursor-pointer transition hover:bg-purple-50/60 dark:hover:bg-cyan-400/10 ${loading ? "pointer-events-none opacity-50" : ""}`}
                    onClick={() => openDetails(customer)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-sm font-black text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
                          {getInitials(customerName(customer))}
                        </div>
                        <div>
                          <div className="font-black text-gray-950 dark:text-gray-50">
                            {customerName(customer)}
                          </div>
                          <div className="text-[10px] font-bold text-gray-500">
                            #{customerId(customer) || "---"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-black" dir="ltr">
                      <div>{customer.phone || "---"}</div>
                      {secondPhone(customer) ? (
                        <div className="mt-1 text-xs text-gray-400">
                          {secondPhone(customer)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                         
                        variant={
                          (Number(
                            customer.visits_count || customer.visits || 0,
                          ) > 10
                            ? ("accent" as any)
                            : Number(
                                  customer.visits_count || customer.visits || 0,
                                ) >= 2
                              ? "info"
                              : "outline") as any
                        }
                      >
                        {customer.visits_count || customer.visits || 0} زيارة
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center font-black text-emerald-600">
                      {formatCurrency(
                        customer.lifetime_spend ||
                          customer.total_spend ||
                          customer.totalSpend ||
                          0,
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="primary"
                          size="icon"
                          title="عرض التفاصيل"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/customers/${customerId(customer)}`);
                          }}
                        >
                          <Eye size={18} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetails(customer);
                          }}
                        >
                          <History size={18} />
                        </Button>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(customer);
                            }}
                          >
                            <Trash2 size={18} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-8 py-16 text-center text-gray-500"
                    >
                      لا يوجد عملاء مطابقين
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {/* Card View */}
        {viewMode === "cards" && (
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCustomers.map((customer, index) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  key={customerId(customer) || index}
                  onClick={() => openDetails(customer)}
                  className="group flex flex-col rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 hover:shadow-premium transition-all cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                        {getInitials(customerName(customer))}
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-main leading-tight">
                          {customerName(customer)}
                        </h3>
                        <p className="text-[9px] font-bold text-muted">
                          #{customerId(customer) || "---"}
                        </p>
                      </div>
                    </div>
                    <Badge
                       
                      variant={
                        (Number(customer.visits_count || customer.visits || 0) >
                        10
                          ? ("accent" as any)
                          : Number(
                                customer.visits_count || customer.visits || 0,
                              ) >= 2
                            ? "info"
                            : "outline") as any
                      }
                      className="rounded-md px-2 py-0.5 text-[8px] font-black shrink-0"
                    >
                      {customer.visits || 0}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted font-bold">الهاتف:</span>
                      <span className="font-black text-main" dir="ltr">
                        {customer.phone || "---"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted font-bold">الإنفاق:</span>
                      <span className="font-black text-success">
                        {formatCurrency(
                          customer.lifetime_spend ||
                            customer.total_spend ||
                            customer.totalSpend ||
                            0,
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-auto">
                    <Button
                      variant="secondary"
                      className="flex-1 h-9 rounded-xl text-[10px] font-black"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetails(customer);
                      }}
                    >
                      <History className="h-3.5 w-3.5 ml-1.5" /> السجل
                    </Button>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        className="w-9 h-9 rounded-xl text-danger/60 hover:text-danger hover:bg-danger/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(customer);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            {filteredCustomers.length === 0 && (
              <div className="py-12 text-center text-muted font-bold">
                لا يوجد عملاء مطابقين
              </div>
            )}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-white/10">
            <div className="text-center text-xs font-bold text-gray-500 sm:text-right">
              عرض {filteredCustomers.length} من {totalCount}
            </div>
            <div className="flex items-center justify-center gap-3 sm:justify-end">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <ChevronRight size={18} />
              </Button>
              <span className="text-xs font-black">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
              >
                <ChevronLeft size={18} />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>الملف الاستراتيجي للعميل</DialogTitle>
            <DialogDescription>
              مراجعة بيانات العميل وسجل التعاملات.
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-5 bg-soft">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6D28D9] text-2xl font-black text-white dark:bg-[#22D3EE] dark:text-[#121212]">
                  {getInitials(customerName(selectedCustomer))}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-950 dark:text-gray-50">
                    {customerName(selectedCustomer)}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-gray-500" dir="ltr">
                    {selectedCustomer.phone || "---"}
                  </p>
                  {secondPhone(selectedCustomer) ? (
                    <p
                      className="mt-1 text-xs font-bold text-gray-400"
                      dir="ltr"
                    >
                      رقم آخر: {secondPhone(selectedCustomer)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MiniStat
                  label="الزيارات"
                  value={`${selectedCustomer.visits_count || selectedCustomer.visits || 0} زيارة`}
                  icon={History}
                />
                <MiniStat
                  label="إجمالي الإنفاق"
                  value={
                    formatCurrency(
                      selectedCustomer.lifetime_spend ||
                        selectedCustomer.total_spend ||
                        selectedCustomer.totalSpend ||
                        0,
                    ) || ""
                  }
                  icon={CreditCard}
                />
                <MiniStat
                  label="آخر زيارة"
                  value={
                    selectedCustomer.last_visit
                      ? new Date(
                          selectedCustomer.last_visit,
                        ).toLocaleDateString("ar-EG")
                      : "---"
                  }
                  icon={Clock}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                selectedCustomer && openEditCustomer(selectedCustomer)
              }
            >
              تحديث الملف
            </Button>
            <Button disabled={loading} onClick={() => setIsDetailsOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
            <DialogDescription>
              أدخل اسم العميل ورقم الجوال. رقم إضافي اختياري.
            </DialogDescription>
          </DialogHeader>
          <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <Input
                value={customerForm.name || ""}
                onChange={(event) =>
                  setCustomerForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="مثال: أحمد محمد"
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                رقم الجوال <span className="text-red-500">*</span>
              </label>
              <Input
                value={customerForm.phone || ""}
                onChange={(event) =>
                  setCustomerForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                placeholder="010XXXXXXXX"
                dir="ltr"
                type="tel"
                className="h-12 text-lg"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                رقم إضافي (اختياري)
                <span className="text-xs font-normal text-slate-400 uppercase tracking-normal">
                  اختياري
                </span>
              </label>
              <Input
                value={customerForm.phone2 || ""}
                onChange={(event) =>
                  setCustomerForm((previous) => ({
                    ...previous,
                    phone2: event.target.value,
                  }))
                }
                placeholder="010XXXXXXXX"
                dir="ltr"
                type="tel"
                className="h-12 text-lg"
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={closeCustomerForm}
              disabled={isSavingCustomer}
            >
              إلغاء
            </Button>
            <Button
              className="flex-1"
              disabled={loading}
              onClick={handleCustomerFormSubmit}
              loading={isSavingCustomer}
            >
              {editingCustomer ? "حفظ التغييرات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف العميل؟</DialogTitle>
            <DialogDescription>
              سيتم حذف بيانات{" "}
              {deleteTarget ? customerName(deleteTarget) : "العميل"} بشكل نهائي.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setDeleteTarget(null)}
            >
              إلغاء
            </Button>
            <Button variant="danger" disabled={loading} onClick={handleDelete}>
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-6 border-border border-border shadow-sm hover:shadow-xl transition-all duration-500 group">
      <div className="flex items-center gap-5">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110 ${color}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black text-main text-main">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-border bg-soft p-4 border-border bg-soft">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className="text-indigo-600 dark:text-sky-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
      </div>
      <div className="truncate text-sm font-black text-main text-main">
        {value}
      </div>
    </div>
  );
}
