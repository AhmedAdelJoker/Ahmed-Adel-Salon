import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Search,
  UserX,
  RotateCcw,
  Trash2,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  Download,
  X,
  Check,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import CustomerDetailsDialog from "@/features/customers/components/CustomerDetailsDialog";
import { exportService } from "@/services/exportService";
import { cn, formatDateTime } from "@/lib/core/utils";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { PageHeader, SkeletonCard } from "@/components/shared/PremiumUI";
import { StatCard } from "@/components/shared/DisplayComponents";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const CustomerArchive = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const res = await api.get("/customers/archive");
      const data = normalizeListResponse(res);
      setCustomers(data.items || data);
    } catch (err) {
      toast.error("فشل تحميل أرشيف العملاء");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const handleRestore = async () => {
    if (!confirmTarget) return;
    try {
      setIsActionLoading(true);
      await api.post(`/customers/${confirmTarget.customer_id}/restore`);
      toast.success("تم استعادة العميل بنجاح");
      setConfirmTarget(null);
      setConfirmAction(null);
      fetchArchive();
    } catch (err) {
      toast.error("فشل استعادة العميل");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmTarget) return;
    try {
      setIsActionLoading(true);
      await api.delete(`/customers/${confirmTarget.customer_id}/permanent`);
      toast.success("تم حذف العميل نهائياً");
      setConfirmTarget(null);
      setConfirmAction(null);
      fetchArchive();
    } catch (error) {

      const msg = (error as any)?.response?.data?.detail || "فشل الحذف النهائي";
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsActionLoading(true);
      const res = await api.post("/customers/archive/bulk-restore", {
        customer_ids: Array.from(selectedIds),
      });
      // 207 Multi-Status: some restored, some blocked (related records)
      if (res.status === 207 && res.data) {
        const { restored, blocked, detail } = res.data;
        toast.success(
          `تم استعادة ${restored?.length ?? selectedIds.size} عميل. تعذّر استعادة ${
            blocked?.length ?? 0
          } عميل.`,
          { duration: 5000 },
        );
        if (detail) console.warn("Bulk restore partial:", detail);
      } else {
        toast.success(`تم استعادة ${selectedIds.size} عميل بنجاح`);
      }
      setSelectedIds(new Set());
      fetchArchive();
    } catch (err) {
      const msg = (err as any)?.response?.data?.detail || "فشل الاستعادة الجماعية";
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsActionLoading(true);
      const res = await api.delete("/customers/archive/bulk-permanent", {
        data: { customer_ids: Array.from(selectedIds) },
      });
      // 207 Multi-Status: some deleted, some blocked (related records)
      if (res.status === 207 && res.data) {
        const { deleted, blocked, detail } = res.data;
        toast.success(
          `تم حذف ${deleted?.length || 0} عميل. تعذّر حذف ${
            blocked?.length || 0
          } عميل (لديهم سجلات مرتبطة).`,
          { duration: 5000 },
        );
        if (detail) console.warn("Bulk delete partial:", detail);
      } else {
        toast.success(`تم حذف ${selectedIds.size} عميل نهائياً`);
      }
      setSelectedIds(new Set());
      fetchArchive();
    } catch (error) {

      const msg = (error as any)?.response?.data?.detail || "فشل الحذف النهائي الجماعي";
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      const filename = `customers_archive_${new Date().toISOString().split("T")[0]}`;
      await exportService.downloadExcel(
        "/exports/customers/excel",
        filename,
        {},
      );
      toast.success("تم تصدير الأرشيف بنجاح");
    } catch (err) {
      toast.error("فشل تصدير الأرشيف");
    } finally {
      setIsExporting(false);
    }
  };

  const openConfirm = (customer: any, action: string) => {
    setConfirmTarget(customer);
    setConfirmAction(action);
  };

  const closeSingleConfirm = () => {
    setConfirmTarget(null);
    setConfirmAction(null);
  };

  const toggleSelect = (customerId: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const filteredCustomers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (c) =>
        `${c.first_name || ""} ${c.last_name || ""}`
          .toLowerCase()
          .includes(query) ||
        c.phone?.includes(query) ||
        c.email?.toLowerCase().includes(query),
    );
  }, [customers, searchTerm]);

  // Derived selection state — always in sync with the visible list.
  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIds.has(c.customer_id));

  const toggleSelectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredCustomers.forEach((c) => next.delete(c.customer_id));
      } else {
        filteredCustomers.forEach((c) => next.add(c.customer_id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // Selections belong to the previous filter — reset to avoid acting on hidden rows.
    setSelectedIds(new Set());
  };

  return (
    <div className="erp-page-container space-y-6 pb-16">
      <ConfirmDialog
        open={!!confirmTarget && confirmAction === "restore"}
        onOpenChange={(open) => {
          if (!open) closeSingleConfirm();
        }}
        title="استعادة العميل؟"
        description="هل أنت متأكد من رغبتك في استعادة هذا العميل للعمل؟ سيتم إرجاعه للقائمة النشطة مع جميع بياناته."
        onConfirm={handleRestore}
        loading={isActionLoading}
        confirmText="استعادة"
      />

      <ConfirmDialog
        open={!!confirmTarget && confirmAction === "permanent_delete"}
        onOpenChange={(open) => {
          if (!open) closeSingleConfirm();
        }}
        title="حذف نهائي لا يمكن التراجع عنه"
        description={`سيتم حذف العميل ${confirmTarget?.first_name || ""} ${confirmTarget?.last_name || ""} وجميع بياناته نهائياً. قد يفشل الحذف إذا كان للعميل فواتير مرتبطة.`}
        onConfirm={handlePermanentDelete}
        loading={isActionLoading}
        confirmText="حذف نهائي"
        variant="danger"
      />

      <ConfirmDialog
        open={confirmAction === "bulk_restore"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title="استعادة جماعية؟"
        description={`هل أنت متأكد من استعادة ${selectedIds.size} عميل محدد؟`}
        onConfirm={handleBulkRestore}
        loading={isActionLoading}
        confirmText="استعادة الجميع"
      />

      <ConfirmDialog
        open={confirmAction === "bulk_permanent_delete"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title="حذف نهائي جماعي"
        description={`سيتم حذف ${selectedIds.size} عميل وجميع بياناتهم نهائياً.`}
        onConfirm={handleBulkPermanentDelete}
        loading={isActionLoading}
        confirmText="حذف الجميع"
        variant="danger"
      />

      <CustomerDetailsDialog
        open={!!detailsTarget}
        onOpenChange={(open) => {
          if (!open) setDetailsTarget(null);
        }}
        customer={detailsTarget}
        loading={isActionLoading}
        onClose={() => setDetailsTarget(null)}
        archived
        onRestore={() => {
          if (!detailsTarget) return;
          openConfirm(detailsTarget, "restore");
          setDetailsTarget(null);
        }}
      />

      <PageHeader
        title="أرشيف العملاء"
        subtitle="سجل العملاء المحذوفين — يمكن استعادتهم أو حذفهم نهائياً."
        badge="الأرشيف"
        icon={Archive}
        actions={
          <>
            <Badge className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black tabular-nums">
              {customers.length} عميل
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/customers")}
              title="العودة لقائمة العملاء"
              aria-label="العودة لقائمة العملاء"
              className="h-12 w-12 rounded-2xl border-border/60 bg-soft text-muted shadow-sm hover:border-primary hover:bg-primary/10 hover:text-primary"
            >
              <ChevronRight size={24} />
            </Button>
          </>
        }
      />

      <div data-stats-grid="true">
        <StatCard
          label="إجمالي الأرشيف"
          value={customers.length}
          icon={Archive}
          variant="primary"
          hint="عميل محذوف"
        />
        <StatCard
          label="المحدد حالياً"
          value={selectedIds.size}
          icon={Check}
          variant="warning"
          hint="لإجراء جماعي"
        />
        <StatCard
          label="نتائج البحث"
          value={filteredCustomers.length}
          icon={Search}
          variant="secondary"
          hint={searchTerm.trim() ? `عن "${searchTerm.trim()}"` : "كل السجلات"}
        />
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
            size={16}
          />
          <Input
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="بحث بالاسم أو الجوال أو الإيميل..."
            aria-label="بحث في أرشيف العملاء"
            className="h-11 w-full rounded-xl pr-9 text-sm font-bold shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            loading={isExporting}
            disabled={loading || customers.length === 0}
            className="h-11 gap-1.5 rounded-xl px-4 text-xs font-black"
          >
            <Download size={14} />
            تصدير
          </Button>
        </div>
      </div>

      {/* Select visible / Bulk Actions */}
      {filteredCustomers.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 shadow-soft">
          <button
            type="button"
            onClick={toggleSelectVisible}
            aria-pressed={allVisibleSelected}
            className="flex cursor-pointer items-center gap-2 rounded-lg text-xs font-bold text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                allVisibleSelected
                  ? "border-primary bg-primary"
                  : "border-border hover:border-primary",
              )}
            >
              {allVisibleSelected && <Check size={12} className="text-white" />}
            </span>
            تحديد الظاهر
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tabular-nums text-muted">
                {selectedIds.size} محدد
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-[10px] text-success hover:bg-success-soft"
                onClick={() => setConfirmAction("bulk_restore")}
                disabled={isActionLoading}
              >
                <RotateCcw size={11} className="ml-1" /> استعادة
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-[10px] text-danger hover:bg-danger-soft"
                onClick={() => setConfirmAction("bulk_permanent_delete")}
                disabled={isActionLoading}
              >
                <Trash2 size={11} className="ml-1" /> حذف
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearSelection}
                title="إلغاء التحديد"
                aria-label="إلغاء التحديد"
              >
                <X size={12} />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Customer Grid / Loading / Empty */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} variant="content" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-16 text-center sm:py-20">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-soft sm:h-16 sm:w-16">
            <Archive size={28} className="text-muted" />
          </div>
          <p className="text-sm font-black text-main sm:text-base">
            {customers.length === 0 ? "الأرشيف فارغ" : "لا توجد نتائج مطابقة"}
          </p>
          <p className="mt-1 text-xs font-bold text-muted">
            {customers.length === 0
              ? "لا يوجد عملاء محذوفون حالياً"
              : "جرّب كلمة بحث مختلفة أو امسح البحث لعرض الكل"}
          </p>
          {customers.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSearchChange("")}
              className="mt-4 gap-1.5 rounded-xl text-xs font-black"
            >
              <X size={13} /> مسح البحث
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => {
            const isSelected = selectedIds.has(customer.customer_id);
            return (
              <div
                key={customer.customer_id}
                className={cn(
                  "rounded-2xl border border-border bg-card p-3 shadow-soft transition-all sm:p-4",
                  isSelected && "border-primary/40 bg-primary-soft/10 ring-2 ring-primary/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelect(customer.customer_id)}
                    aria-pressed={isSelected}
                    aria-label={`تحديد ${customer.first_name || ""} ${customer.last_name || ""}`}
                    title={isSelected ? "إلغاء التحديد" : "تحديد للاجراء الجماعي"}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-border hover:border-primary",
                    )}
                  >
                    {isSelected && (
                      <Check size={12} className="text-white" />
                    )}
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-soft sm:h-10 sm:w-10">
                    <UserX size={18} className="text-danger" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="truncate text-sm font-black text-main sm:text-base"
                      title={`${customer.first_name} ${customer.last_name}`}
                    >
                      {customer.first_name} {customer.last_name}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                      <Calendar size={10} />
                      <span>حذف: {customer.deleted_at ? formatDateTime(customer.deleted_at) : "---"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 rounded-lg bg-soft p-2 sm:p-2.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                    <Phone size={10} className="shrink-0" />
                    <span dir="ltr" className="truncate">
                      {customer.phone || "---"}
                    </span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                      <Mail size={10} className="shrink-0" />
                      <span dir="ltr" className="truncate">
                        {customer.email}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                    <ShieldCheck size={10} className="shrink-0" />
                    <span>
                      {customer.current_tier || "Bronze"} •{" "}
                      {customer.loyalty_points || 0} نقطة
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openConfirm(customer, "restore")}
                    className="h-8 flex-1 rounded-lg border-success/30 text-[10px] font-black text-success hover:bg-success-soft sm:text-xs"
                  >
                    <RotateCcw size={11} className="ml-1" /> استعادة
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDetailsTarget(customer)}
                    className="h-8 w-8 shrink-0 rounded-lg text-primary hover:bg-primary/10"
                    title="تفاصيل أكثر"
                    aria-label={`عرض تفاصيل ${customer.first_name || ""} ${customer.last_name || ""}`}
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => openConfirm(customer, "permanent_delete")}
                    className="h-8 w-8 shrink-0 rounded-lg text-danger hover:bg-danger-soft"
                    title="حذف نهائي"
                    aria-label={`حذف ${customer.first_name || ""} ${customer.last_name || ""} نهائياً`}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerArchive;
