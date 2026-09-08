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
  CheckSquare,
  Square,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { exportService } from "@/services/exportService";
import { cn } from "@/lib/core/utils";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const CustomerArchive = () => {
  const navigate = useNavigate();
   
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
   
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

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
      await api.post("/customers/archive/bulk-restore", {
        customer_ids: Array.from(selectedIds),
      });
      toast.success(`تم استعادة ${selectedIds.size} عميل بنجاح`);
      setSelectedIds(new Set());
      setSelectAll(false);
      fetchArchive();
    } catch (err) {
      toast.error("فشل الاستعادة الجماعية");
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
      setSelectAll(false);
      fetchArchive();
    } catch (error) {
       
      const msg = (error as any)?.response?.data?.detail || "فشل الحذف النهائي الجماعي";
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const filename = `customers_archive_${new Date().toISOString().split("T")[0]}`;
      await exportService.downloadExcel(
        "/exports/customers/excel",
        filename,
        {},
      );
      toast.success("تم تصدير الأرشيف بنجاح");
    } catch (err) {
      toast.error("فشل تصدير الأرشيف");
    }
  };

  const openConfirm = (customer, action) => {
    setConfirmTarget(customer);
    setConfirmAction(action);
  };

  const toggleSelect = (customerId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(filteredCustomers.map((c) => c.customer_id)));
      setSelectAll(true);
    }
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

  const formatDate = (dateStr) => {
    if (!dateStr) return "---";
    try {
      return new Date(dateStr).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (err) {
      return "---";
    }
  };

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <ConfirmDialog
          open={!!confirmTarget && confirmAction === "restore"}
          onOpenChange={(open) =>
            !open && setConfirmTarget(null) && setConfirmAction(null)
          }
          title="استعادة العميل؟"
          description="هل أنت متأكد من رغبتك في استعادة هذا العميل للعمل؟ سيتم إرجاعه للقائمة النشطة مع جميع بياناته."
          onConfirm={handleRestore}
          loading={isActionLoading}
          confirmText="استعادة"
        />

        <ConfirmDialog
          open={!!confirmTarget && confirmAction === "permanent_delete"}
          onOpenChange={(open) =>
            !open && setConfirmTarget(null) && setConfirmAction(null)
          }
          title="حذف نهائي لا يمكن التراجع عنه"
          description={`سيتم حذف العميل ${confirmTarget?.first_name || ""} ${confirmTarget?.last_name || ""} وجميع بياناته نهائياً. قد يفشل الحذف إذا كان للعميل فواتير مرتبطة.`}
          onConfirm={handlePermanentDelete}
          loading={isActionLoading}
          confirmText="حذف نهائي"
          variant="danger"
        />

        <ConfirmDialog
          open={confirmAction === "bulk_restore"}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title="استعادة جماعية؟"
          description={`هل أنت متأكد من استعادة ${selectedIds.size} عميل محدد؟`}
          onConfirm={handleBulkRestore}
          loading={isActionLoading}
          confirmText="استعادة الجميع"
        />

        <ConfirmDialog
          open={confirmAction === "bulk_permanent_delete"}
          onOpenChange={(open) => !open && setConfirmAction(null)}
          title="حذف نهائي جماعي"
          description={`سيتم حذف ${selectedIds.size} عميل وجميع بياناتهم نهائياً.`}
          onConfirm={handleBulkPermanentDelete}
          loading={isActionLoading}
          confirmText="حذف الجميع"
          variant="danger"
        />

        {/* Header */}
        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/customers")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-soft sm:h-10 sm:w-10"
            >
              <ChevronRight size={16} className="text-muted" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 sm:h-11 sm:w-11">
              <Archive size={18} className="text-purple-500 sm:hidden" />
              <Archive size={20} className="hidden text-purple-500 sm:block" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-black text-main sm:text-lg lg:text-xl">
                أرشيف العملاء
              </h1>
              <p className="hidden text-[10px] font-bold text-muted sm:block">
                سجل العملاء المحذوفين — يمكن استعادتهم أو حذفهم نهائياً
              </p>
            </div>
            <Badge className="hidden shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black sm:inline-flex">
              {filteredCustomers.length} عميل
            </Badge>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
              size={14}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم أو الجوال أو الإيميل..."
              className="h-10 w-full pr-9 text-sm sm:h-11"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading}
              className="h-10 rounded-xl px-3 text-xs"
            >
              <Download size={14} className="ml-1.5" />
              <span className="hidden sm:inline">تصدير</span>
            </Button>
          </div>
        </div>

        {/* Select All / Bulk Actions */}
        {filteredCustomers.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 shadow-soft">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex cursor-pointer items-center gap-2 text-xs font-bold text-muted"
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                  selectAll
                    ? "border-primary bg-primary"
                    : "border-border hover:border-primary",
                )}
              >
                {selectAll ? (
                  <CheckSquare size={12} className="text-white" />
                ) : (
                  <Square size={12} />
                )}
              </div>
              تحديد الكل
            </button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted">
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
                  onClick={() => {
                    setSelectedIds(new Set());
                    setSelectAll(false);
                  }}
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
              <PremiumCard key={i} className="animate-pulse p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-soft" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-soft" />
                    <div className="h-2 w-1/2 rounded bg-soft" />
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-2 w-full rounded bg-soft" />
                  <div className="h-2 w-3/4 rounded bg-soft" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-8 flex-1 rounded-lg bg-soft" />
                  <div className="h-8 w-8 rounded-lg bg-soft" />
                </div>
              </PremiumCard>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-16 text-center sm:py-20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-soft sm:h-16 sm:w-16">
              <Archive size={24} className="text-muted sm:hidden" />
              <Archive size={28} className="hidden text-muted sm:block" />
            </div>
            <p className="text-sm font-black text-main sm:text-base">
              الأرشيف فارغ
            </p>
            <p className="mt-1 text-xs font-bold text-muted">
              لا يوجد عملاء محذوفون حالياً
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustomers.map((customer) => {
              const isSelected = selectedIds.has(customer.customer_id);
              return (
                <PremiumCard
                  key={customer.customer_id}
                  className={cn(
                    "group cursor-pointer p-3 transition-all hover:shadow-premium sm:p-4",
                    isSelected && "ring-2 ring-primary/40 bg-primary-soft/10",
                  )}
                   
                  {...{ onClick: () => toggleSelect(customer.customer_id) } as any}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(customer.customer_id);
                      }}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {isSelected && (
                        <CheckSquare size={12} className="text-white" />
                      )}
                    </button>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-soft sm:h-10 sm:w-10">
                      <UserX size={16} className="text-danger sm:hidden" />
                      <UserX
                        size={18}
                        className="hidden text-danger sm:block"
                      />
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
                        <span>حذف: {formatDate(customer.deleted_at)}</span>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        openConfirm(customer, "restore");
                      }}
                      className="h-8 flex-1 rounded-lg border-success/30 text-[10px] font-black text-success hover:bg-success-soft sm:text-xs"
                    >
                      <RotateCcw size={11} className="ml-1" /> استعادة
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openConfirm(customer, "permanent_delete");
                      }}
                      className="h-8 w-8 shrink-0 rounded-lg text-danger hover:bg-danger-soft"
                      title="حذف نهائي"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerArchive;
