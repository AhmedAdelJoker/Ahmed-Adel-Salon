import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarDays,
  CircleSlash,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSalon } from "@/context/SalonContext";
import { printThermalReceipt } from "@/lib/print/receipt";
import { getIntlLocale } from "@/lib/format/locale";
import i18n from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import { PageHeader } from "@/components/shared/PremiumUI";
import { PageShell } from "@/components/shared/PageShell";
import InlineNotice from "@/components/shared/InlineNotice";
import {
  useInvoicesData,
  formatCurrency,
  isInvoiceEditable,
  InvoicesToolbar,
  InvoicesTable,
  InvoicesPagination,
  InvoiceDetailsDialog,
  AdjustmentRequestDialog,
} from "@/features/invoices";

export default function Invoices() {
  const { t } = useTranslation("invoices");
  const { settings } = useSalon();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    adjustmentsError,
    error,
    loading,
    query,
    setQuery,
    searchPending,
    paymentFilter,
    setPaymentFilter,
    statusFilter,
    setStatusFilter,
    fromDate,
    toDate,
    currentPage,
    setCurrentPage,
    timePreset,
    applyPreset,
    applyRange,
    shiftMonth,
    sortConfig,
    showColumnPicker,
    setShowColumnPicker,
    pageSize,
    totalCount,
    visibleColumns,
    toggleColumn,
    handleSort,
    refreshAll,
    filteredInvoices,
    summary,
    exportToCSV,
    exporting,
    adjustmentDialog,
    setAdjustmentDialog,
    adjustmentSubmitting,
    busyPdfId,
    busyWhatsappId,
    selectedInvoice,
    setSelectedInvoice,
    pendingAdjustments,
    lastUpdated,
    openInvoicePdf,
    sendInvoicePdfWhatsapp,
    openAdjustmentDialog,
    submitAdjustmentRequest,
  } = useInvoicesData();

  const canReviewAdjustments = ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN"].includes(
    String(user?.role ?? "").toUpperCase(),
  );
  const hasFilters =
    Boolean(query.trim()) ||
    paymentFilter !== "all" ||
    statusFilter !== "all" ||
    timePreset !== "month";

  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const rangeLabel = (from: string, to: string): string => {
    if (!from || !to) return t("hero.allRanges");
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return `${from} — ${to}`;
    }
    const month = (date: Date) =>
      date.toLocaleDateString(locale, { month: "long" });
    if (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth()
    ) {
      return `${month(start)} ${start.getFullYear()}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString(locale, { day: "2-digit", month: "short" })} — ${end.toLocaleDateString(locale, { day: "2-digit", month: "short" })} ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })} — ${end.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}`;
  };

  return (
    <PageShell contained>
      <PageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        badge={t("page.badge")}
        icon={Receipt}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canReviewAdjustments && (
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3"
                onClick={() => navigate("/approvals")}
                aria-label={t("actions.adjustmentRequests")}
              >
                <ShieldCheck size={14} className="ms-1.5" />
                <span className="hidden sm:inline">{t("actions.adjustmentRequests")}</span>
                {pendingAdjustments > 0 && (
                  <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-black text-white">
                    {pendingAdjustments}
                  </span>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-10 rounded-xl px-3"
              onClick={() => navigate("/invoices/archive")}
              aria-label={t("actions.archive")}
            >
              <Archive size={14} className="ms-1.5" />
              <span className="hidden sm:inline">{t("actions.archive")}</span>
            </Button>
            <Button
              className="h-10 rounded-xl px-4"
              onClick={() => navigate("/pos")}
            >
              <Plus size={15} className="ms-1.5" />
              {t("actions.newInvoice")}
            </Button>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-strong via-primary to-primary-strong px-5 py-5 text-white shadow-premium sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -start-14 -bottom-24 h-56 w-56 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-white/70">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                <Wallet size={14} />
              </span>
              <span>{t("hero.netSales")}</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-black text-white/90">
                <CalendarDays size={11} />
                {rangeLabel(fromDate, toDate)}
              </span>
              {timePreset === "custom" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[10px] font-black text-white/90">
                  {t("hero.customRange")}
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-2 text-3xl font-black tabular-nums tracking-tight sm:text-4xl",
                loading && summary.count === 0 && "opacity-40",
              )}
            >
              {loading && summary.count === 0
                ? "—"
                : formatCurrency(summary.total)}
            </p>
            <p className="mt-1 text-[11px] font-bold text-white/60">
              {loading && summary.count === 0
                ? t("hero.loadingSummary")
                : t("hero.summaryLine", {
                    count: summary.count,
                    closed: summary.closed,
                  })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[540px]">
            <HeroStat
              icon={Receipt}
              label={t("hero.invoiceCount")}
              value={loading && summary.count === 0 ? "—" : summary.count}
            />
            <HeroStat
              icon={TrendingUp}
              label={t("hero.average")}
              value={
                loading && summary.count === 0
                  ? "—"
                  : formatCurrency(summary.average)
              }
            />
            <HeroStat
              icon={CircleSlash}
              label={t("hero.cancelled")}
              value={loading && summary.count === 0 ? "—" : summary.closed}
            />
            <HeroStat
              icon={ShieldCheck}
              label={t("hero.adjustmentRequests")}
              value={pendingAdjustments}
            />
          </div>
        </div>
      </section>

      <div className="mt-4">
        <InvoicesToolbar
          query={query}
          setQuery={setQuery}
          searchPending={searchPending}
          fromDate={fromDate}
          toDate={toDate}
          timePreset={timePreset}
          onApplyPreset={applyPreset}
          onApplyRange={applyRange}
          onShiftMonth={shiftMonth}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          setCurrentPage={setCurrentPage}
          showColumnPicker={showColumnPicker}
          setShowColumnPicker={setShowColumnPicker}
          visibleColumns={visibleColumns}
          toggleColumn={toggleColumn}
          exportToCSV={exportToCSV}
          exporting={exporting}
        />
      </div>

      {adjustmentsError && !loading && (
        <div className="mt-3">
          <InlineNotice tone="warning">{adjustmentsError}</InlineNotice>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-main">{t("table.ledger")}</h2>
            <Badge variant="secondary" size="sm">
              {totalCount}
            </Badge>
            {searchPending && (
              <span className="text-[10px] font-bold text-muted">
                {t("table.searching")}
              </span>
            )}
            {lastUpdated && !loading && (
              <span className="hidden text-[10px] font-bold text-muted sm:inline">
                {t("toasts.lastUpdated", {
                  time: lastUpdated.toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={refreshAll}
            disabled={loading}
            aria-label={t("actions.refreshInvoices")}
            title={t("actions.refresh")}
          >
            <RefreshCw size={15} className={cn(loading && "animate-spin")} />
          </Button>
        </div>

        {error && filteredInvoices.length > 0 && (
          <div className="border-b border-border/60 p-2">
            <InlineNotice tone="warning">{error}</InlineNotice>
          </div>
        )}

        <InvoicesTable
          loading={loading}
          error={error}
          filteredInvoices={filteredInvoices}
          visibleColumns={visibleColumns}
          sortConfig={sortConfig}
          handleSort={handleSort}
          busyPdfId={busyPdfId}
          busyWhatsappId={busyWhatsappId}
          hasFilters={hasFilters}
          onSelectInvoice={(invoice) => setSelectedInvoice(invoice)}
          onPrintInvoice={(invoice) => printThermalReceipt(invoice, settings)}
          onOpenPdf={(invoice) => openInvoicePdf(invoice)}
          onSendWhatsapp={(invoice) => sendInvoicePdfWhatsapp(invoice)}
          onRequestAdjustment={(invoice) => {
            if (!isInvoiceEditable(invoice)) {
              toast.error(t("toasts.expiredEdit"));
              return;
            }
            openAdjustmentDialog(invoice);
          }}
          onResetFilters={() => {
            setQuery("");
            setPaymentFilter("all");
            setStatusFilter("all");
            applyPreset("month");
          }}
          onRetry={refreshAll}
          onCreateFromPos={() => navigate("/pos")}
        />

        {!loading && filteredInvoices.length > 0 && (
          <InvoicesPagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <InvoiceDetailsDialog
        selectedInvoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onPrintSelected={() => {
          if (selectedInvoice) printThermalReceipt(selectedInvoice, settings);
        }}
        onOpenPdfSelected={() => {
          if (selectedInvoice) openInvoicePdf(selectedInvoice);
        }}
      />

      <AdjustmentRequestDialog
        adjustmentDialog={adjustmentDialog}
        onAdjustmentDialogChange={setAdjustmentDialog}
        adjustmentSubmitting={adjustmentSubmitting}
        onSubmit={submitAdjustmentRequest}
      />
    </PageShell>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[9px] font-bold text-white/60">
        <Icon size={12} />
        {label}
      </div>
      <p className="mt-1 truncate text-base font-black tabular-nums">
        {value}
      </p>
    </div>
  );
}
