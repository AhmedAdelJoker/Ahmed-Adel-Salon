import { EmptyState } from "@/components/shared/EmptyState";
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
import { CustomerDetailsDialog } from "@/features/customers";
import { exportService } from "@/services/exportService";
import { cn, formatDateTime } from "@/lib/core/utils";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import { PageHeader, SkeletonCard } from "@/components/shared/PremiumUI";
import { StatCard } from "@/components/shared/DisplayComponents";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const CustomerArchive = () => {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
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
      toast.error(t("custArch.loadFailed"));
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
      toast.success(t("custArch.restoreSuccess"));
      setConfirmTarget(null);
      setConfirmAction(null);
      fetchArchive();
    } catch (err) {
      toast.error(t("custArch.restoreFailed"));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirmTarget) return;
    try {
      setIsActionLoading(true);
      await api.delete(`/customers/${confirmTarget.customer_id}/permanent`);
      toast.success(t("custArch.deleteSuccess"));
      setConfirmTarget(null);
      setConfirmAction(null);
      fetchArchive();
    } catch (error) {

      const msg = (error as any)?.response?.data?.detail || t("custArch.deleteFailed");
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
          t("custArch.bulkRestorePartial", {
            restored: restored?.length ?? selectedIds.size,
            failed: blocked?.length ?? 0,
          }),
          { duration: 5000 },
        );
        if (detail) console.warn("Bulk restore partial:", detail);
      } else {
        toast.success(t("custArch.bulkRestoreSuccess", { count: selectedIds.size }));
      }
      setSelectedIds(new Set());
      fetchArchive();
    } catch (err) {
      const msg = (err as any)?.response?.data?.detail || t("custArch.bulkRestoreFailed");
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
          t("custArch.bulkDeletePartial", {
            deleted: deleted?.length || 0,
            failed: blocked?.length || 0,
          }),
          { duration: 5000 },
        );
        if (detail) console.warn("Bulk delete partial:", detail);
      } else {
        toast.success(t("custArch.bulkDeleteSuccess", { count: selectedIds.size }));
      }
      setSelectedIds(new Set());
      fetchArchive();
    } catch (error) {

      const msg = (error as any)?.response?.data?.detail || t("custArch.bulkDeleteFailed");
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
      toast.success(t("custArch.exportSuccess"));
    } catch (err) {
      toast.error(t("custArch.exportFailed"));
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
        title={t("custArch.restoreSingleTitle")}
        description={t("custArch.restoreSingleDesc")}
        onConfirm={handleRestore}
        loading={isActionLoading}
        confirmText={t("custArch.restoreSingleConfirm")}
      />

      <ConfirmDialog
        open={!!confirmTarget && confirmAction === "permanent_delete"}
        onOpenChange={(open) => {
          if (!open) closeSingleConfirm();
        }}
        title={t("custArch.deleteSingleTitle")}
        description={t("custArch.deleteSingleDesc", { firstName: confirmTarget?.first_name || "", lastName: confirmTarget?.last_name || "" })}
        onConfirm={handlePermanentDelete}
        loading={isActionLoading}
        confirmText={t("custArch.deleteSingleConfirm")}
        variant="danger"
      />

      <ConfirmDialog
        open={confirmAction === "bulk_restore"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={t("custArch.restoreBulkTitle")}
        description={t("custArch.restoreBulkDesc", { count: selectedIds.size })}
        onConfirm={handleBulkRestore}
        loading={isActionLoading}
        confirmText={t("custArch.restoreBulkConfirm")}
      />

      <ConfirmDialog
        open={confirmAction === "bulk_permanent_delete"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={t("custArch.deleteBulkTitle")}
        description={t("custArch.deleteBulkDesc", { count: selectedIds.size })}
        onConfirm={handleBulkPermanentDelete}
        loading={isActionLoading}
        confirmText={t("custArch.deleteBulkConfirm")}
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
        title={t("custArch.title")}
        subtitle={t("custArch.subtitle")}
        badge={t("custArch.badge")}
        icon={Archive}
        actions={
          <>
            <Badge className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black tabular-nums">
              {customers.length} {t("custArch.statResigned")}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/customers")}
              title={t("custArch.backButton")}
              aria-label={t("custArch.backButtonAria")}
              className="h-12 w-12 rounded-2xl border-border/60 bg-soft text-muted shadow-sm hover:border-primary hover:bg-primary/10 hover:text-primary"
            >
              <ChevronRight size={24} />
            </Button>
          </>
        }
      />

      <div data-stats-grid="true">
        <StatCard
          label={t("custArch.statTotal")}
          value={customers.length}
          icon={Archive}
          variant="primary"
          hint={t("custArch.statResigned")}
        />
        <StatCard
          label={t("custArch.statSelected")}
          value={selectedIds.size}
          icon={Check}
          variant="warning"
          hint={t("custArch.statSelectedHint")}
        />
        <StatCard
          label={t("custArch.statSearchResults")}
          value={filteredCustomers.length}
          icon={Search}
          variant="secondary"
          hint={searchTerm.trim() ? t("custArch.statSearchHint", { query: searchTerm.trim() }) : t("custArch.statSearchHintAll")}
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
            placeholder={t("custArch.searchPlaceholder")}
            aria-label={t("custArch.searchAria")}
            className="h-11 w-full rounded-xl pe-9 text-sm font-bold shadow-sm"
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
            {t("custArch.exportButton")}
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
            {t("custArch.selectAllVisible")}
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tabular-nums text-muted">
                {t("custArch.selectedCount", { count: selectedIds.size })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-[10px] text-success hover:bg-success-soft"
                onClick={() => setConfirmAction("bulk_restore")}
                disabled={isActionLoading}
              >
                <RotateCcw size={11} className="ms-1" /> {t("custArch.restoreButton")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-[10px] text-danger hover:bg-danger-soft"
                onClick={() => setConfirmAction("bulk_permanent_delete")}
                disabled={isActionLoading}
              >
                <Trash2 size={11} className="ms-1" /> {t("custArch.deleteButton")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearSelection}
                title={t("custArch.deselect")}
                aria-label={t("custArch.deselectAria")}
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
        <EmptyState
          variant="page"
          icon={Archive}
          title={
            customers.length === 0 ? t("custArch.emptyTitle") : t("custArch.noResults")
          }
          message={
            customers.length === 0
              ? t("custArch.emptyMessage")
              : t("custArch.noResultsHint")
          }
          action={
            customers.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSearchChange("")}
                className="gap-1.5 rounded-xl text-xs font-black"
              >
                <X size={13} /> {t("custArch.clearSearch")}
              </Button>
            ) : null
          }
        />
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
                    aria-label={t("custArch.selectForAction", { firstName: customer.first_name || "", lastName: customer.last_name || "" })}
                    title={isSelected ? t("custArch.deselectForAction") : t("custArch.selectForAction", { firstName: customer.first_name || "", lastName: customer.last_name || "" })}
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
                      <span>{t("custArch.deletedAt", { date: customer.deleted_at ? formatDateTime(customer.deleted_at) : "---" })}</span>
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
                      {t("custArch.loyaltyPoints", { points: customer.loyalty_points || 0 })}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openConfirm(customer, "restore")}
                    className="h-8 flex-1 rounded-lg border-success/30 text-[10px] font-black text-success hover:bg-success-soft sm:text-xs"
                  >
                    <RotateCcw size={11} className="ms-1" /> {t("custArch.restoreButton")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDetailsTarget(customer)}
                    className="h-8 w-8 shrink-0 rounded-lg text-primary hover:bg-primary/10"
                    title={t("custArch.moreDetails")}
                    aria-label={t("custArch.viewDetails", { firstName: customer.first_name || "", lastName: customer.last_name || "" })}
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => openConfirm(customer, "permanent_delete")}
                    className="h-8 w-8 shrink-0 rounded-lg text-danger hover:bg-danger-soft"
                    title={t("custArch.deleteFinal")}
                    aria-label={t("custArch.deleteCustomer", { firstName: customer.first_name || "", lastName: customer.last_name || "" })}
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
