import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState, useRef } from "react";

import toast from "react-hot-toast";
import {
  Activity,
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
  X,
  Download,
  Upload,
  FileDown,
  FileUp,
} from "lucide-react";
import api from "../../services/api";
import {
  normalizeListResponse,
  normalizeItemResponse,
} from "../../services/apiAdapter";
import { exportService } from "../../services/exportService";
import { importService } from "../../services/importService";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { formatCurrency, getInitials } from "../../lib/utils";
import { motion } from "framer-motion";

const EMPTY_CUSTOMER_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  phone2: "",
  email: "",
  notes: "",
};
const pageSize = 10;

const customerId = (customer) =>
  customer?.customer_id || customer?.customerId || customer?.id;
const customerName = (customer) =>
  `${customer?.first_name || customer?.firstName || ""} ${customer?.last_name || customer?.lastName || ""}`.trim() ||
  customer?.name ||
  "عميل مجهول";
const secondPhone = (customer) =>
  customer?.phone2 ||
  customer?.alternate_phone ||
  customer?.secondary_phone ||
  customer?.phone_2 ||
  "";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const fileInputRef = useRef(null);

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

  async function fetchCustomers() {
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
  }

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, debouncedSearch]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const visits = Number(customer.visits || 0);
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
      firstName: customer.first_name || customer.firstName || "",
      lastName: customer.last_name || customer.lastName || "",
      phone: customer.phone || "",
      phone2: secondPhone(customer),
      email: customer.email || "",
      notes: customer.notes || "",
    });
    setIsCustomerFormOpen(true);
    setIsDetailsOpen(false);
  }

  async function handleCustomerFormSubmit() {
    const firstName = customerForm.firstName.trim();
    const phone = customerForm.phone.trim();
    if (!firstName || !phone) {
      toast.error("الاسم الأول ورقم الجوال مطلوبان");
      return;
    }

    const payload = {
      first_name: firstName,
      firstName,
      last_name: customerForm.lastName.trim(),
      lastName: customerForm.lastName.trim(),
      phone,
      phone_normalized: phone.replace(/\s+/g, ""),
      phone2: customerForm.phone2.trim() || null,
      alternate_phone: customerForm.phone2.trim() || null,
      secondary_phone: customerForm.phone2.trim() || null,
      email: customerForm.email.trim() || null,
      notes: customerForm.notes.trim() || null,
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
        if (error?.response?.status !== 422 || !customerForm.phone2.trim())
          throw error;
        const fallbackPayload = { ...payload };
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
      toast.error(error?.response?.data?.detail || "فشل حفظ بيانات العميل");
    } finally {
      setIsSavingCustomer(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/customers/${customerId(deleteTarget)}`);
      toast.success("تم حذف العميل بنجاح");
      setDeleteTarget(null);
      await fetchCustomers();
    } catch (error) {
      console.error("Customer delete error:", error);
      toast.error("فشل في حذف العميل");
    }
  }

  if (loading && customers.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#6D28D9] dark:text-[#22D3EE]">
          <Activity className="h-10 w-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
            تحميل قاعدة بيانات العملاء...
          </p>
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
            customers.filter((customer) => Number(customer.visits || 0) > 10)
              .length || ""
          }
          icon={Star}
          color="bg-amber-500"
        />
        <Kpi
          label="العملاء الجدد"
          value={
            customers.filter((customer) => Number(customer.visits || 0) <= 1)
              .length || ""
          }
          icon={UserPlus}
          color="bg-emerald-600"
        />
        <Kpi
          label="متوسط الإنفاق"
          value={formatCurrency(450) || ""}
          icon={TrendingUp}
          color="bg-blue-600"
        />
      </div>

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
        </div>
      </Card>

      <Card className="overflow-hidden border-none bg-transparent shadow-none lg:border lg:bg-card lg:shadow-sm">
        <div className="hidden overflow-x-auto lg:block">
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
                  className="cursor-pointer transition hover:bg-purple-50/60 dark:hover:bg-cyan-400/10"
                  disabled={loading}
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
                        Number(customer.visits || 0) > 10
                          ? "accent"
                          : Number(customer.visits || 0) >= 2
                            ? "info"
                            : "outline"
                      }
                    >
                      {customer.visits || 0} زيارة
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-center font-black text-emerald-600">
                    {formatCurrency(
                      customer.total_spend || customer.totalSpend || 0,
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
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
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-8 py-16 text-center text-gray-500"
                  >
                    لا يوجد عملاء مطابقين
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Mobile Adaptive Card View */}
        <div className="lg:hidden adaptive-card-grid p-4">
          {filteredCustomers.map((customer, index) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={customerId(customer) || index}
              onClick={() => openDetails(customer)}
              className="group relative flex flex-col p-5 bg-card border border-border/60 rounded-3xl hover:border-accent/40 transition-all shadow-sm active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent font-black">
                    {getInitials(customerName(customer))}
                  </div>
                  <div>
                    <h3 className="font-black text-main leading-none mb-1">
                      {customerName(customer)}
                    </h3>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                      #{customerId(customer) || "---"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    Number(customer.visits || 0) > 10
                      ? "accent"
                      : Number(customer.visits || 0) >= 2
                        ? "info"
                        : "outline"
                  }
                  className="rounded-lg px-2 py-0.5 text-[9px] font-black"
                >
                  {customer.visits || 0} زيارة
                </Badge>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted font-bold">التواصل:</span>
                  <span className="font-black text-main" dir="ltr">
                    {customer.phone || "---"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted font-bold">إجمالي الإنفاق:</span>
                  <span className="font-black text-emerald-600">
                    {formatCurrency(
                      customer.total_spend || customer.totalSpend || 0,
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-border/40">
                <Button
                  variant="secondary"
                  className="flex-1 h-10 rounded-xl text-xs font-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetails(customer);
                  }}
                >
                  <History className="h-4 w-4 ml-2" /> السجل
                </Button>
                <Button
                  variant="ghost"
                  className="w-10 h-10 rounded-xl text-danger/60 hover:text-danger hover:bg-danger/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(customer);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="py-12 text-center text-muted font-bold">
              لا يوجد عملاء مطابقين
            </div>
          )}
        </div>
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
                  value={`${selectedCustomer.visits || 0 || ""} زيارة`}
                  icon={History}
                />
                <MiniStat
                  label="إجمالي الإنفاق"
                  value={
                    formatCurrency(
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
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
            <DialogDescription>
              حدّث بيانات العميل الأساسية لتظهر في الحجز ونقطة البيع.
            </DialogDescription>
          </DialogHeader>
          <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Field
                label="الاسم الأول"
                value={customerForm.firstName || ""}
                onChange={(value) =>
                  setCustomerForm((previous) => ({
                    ...previous,
                    firstName: value,
                  }))
                }
              />
              <Field
                label="اسم العائلة"
                value={customerForm.lastName || ""}
                onChange={(value) =>
                  setCustomerForm((previous) => ({
                    ...previous,
                    lastName: value,
                  }))
                }
              />
              <Field
                label="رقم الجوال"
                value={customerForm.phone || ""}
                onChange={(value) =>
                  setCustomerForm((previous) => ({ ...previous, phone: value }))
                }
                dir="ltr"
              />
              <Field
                label="رقم آخر - اختياري"
                value={customerForm.phone2 || ""}
                onChange={(value) =>
                  setCustomerForm((previous) => ({
                    ...previous,
                    phone2: value,
                  }))
                }
                dir="ltr"
              />
              <Field
                label="البريد الإلكتروني"
                value={customerForm.email || ""}
                onChange={(value) =>
                  setCustomerForm((previous) => ({ ...previous, email: value }))
                }
                dir="ltr"
              />
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                  ملاحظات
                </label>
                <textarea
                  value={customerForm.notes || ""}
                  onChange={(event) =>
                    setCustomerForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-32 w-full rounded-2xl border border-border bg-slate-50 px-5 py-4 text-sm font-bold text-main outline-none transition focus:border-indigo-600/50 focus:ring-4 focus:ring-indigo-600/10 border-border dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={closeCustomerForm}
              disabled={isSavingCustomer}
            >
              إلغاء
            </Button>
            <Button
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

function Field({ label, value, onChange, dir = "rtl" }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black">{label}</label>
      <Input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        dir={dir}
      />
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color }) {
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

function MiniStat({ label, value, icon: Icon }) {
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
