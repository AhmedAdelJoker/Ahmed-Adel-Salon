import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Clock,
  DollarSign,
  Download,
  FileText,
  Printer,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Wallet,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import { parseBackendStamp } from "@/lib/format/date";
import { useDailySummary } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import { type DailySummaryCsvLabels } from "@/features/daily-summary";
import {
  DAILY_SUMMARY_LINKS,
  buildDailySummaryCsv,
  calcNetProfit,
  downloadCsv,
  getShiftDisplayName,
  getShiftInitial,
  todayKey,
  type DailySummaryData,
} from "@/features/daily-summary";

const DailySummaryReport = () => {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const navigate = useNavigate();
  const [date, setDate] = useState(todayKey());

  const { data, isLoading, isFetching, refetch } =
    useDailySummary(date);

  const report: DailySummaryData | undefined = data;
  const summary = report?.summary;
  const shifts = report?.shifts || [];
  const expenses = report?.expenses || [];
  const net = calcNetProfit(report);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = useCallback(() => {
    if (!report || (!shifts.length && !expenses.length))
      return toast.error(t("daily.exportError"));
    const csvLabels: DailySummaryCsvLabels = {
      headers: [t("dailyFeature.cvs.item"), t("dailyFeature.cvs.details"), t("dailyFeature.cvs.value")],
      date: t("dailyFeature.cvs.date"),
      revenue: t("dailyFeature.cvs.revenue"),
      invoices: t("dailyFeature.cvs.invoiceCount"),
      expenses: t("dailyFeature.cvs.expenses"),
      shifts: t("dailyFeature.cvs.shiftCount"),
      netProfit: t("dailyFeature.cvs.netProfit"),
      shiftSingular: t("dailyFeature.cvs.shifts"),
      shiftPlural: t("dailyFeature.cvs.expensesSection"),
      expenseFallback: t("dailyFeature.cvs.expenseFallback"),
      shiftSalesLine: (total: number, count: number) =>
        t("dailyFeature.cvs.shiftSalesLine", { total, count }),
      active: t("dailyFeature.cvs.active"),
      completed: t("dailyFeature.cvs.completed"),
    };
    downloadCsv(`daily_summary_${date}.csv`, buildDailySummaryCsv(report, csvLabels));
    toast.success(t("daily.exported"));
  }, [report, shifts.length, expenses.length, date]);

  if (isLoading && !report) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-bold text-muted">{t("daily.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-6 pb-10">
      <div className="print:hidden">
        <PageHeader
          title={t("daily.title")}
          subtitle={t("daily.subtitle")}
          badge={t("daily.badge")}
          icon={Activity}
          className={undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-auto rounded-xl bg-card border-border font-black text-sm"
              />
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!shifts.length && !expenses.length}
                className="h-11 rounded-xl px-4 font-black border-border bg-card"
              >
                <Download size={16} className="ms-1.5" /> {t("daily.exportCsv")}
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                className="h-11 rounded-xl px-4 font-black border-border bg-card"
              >
                <Printer size={16} className="ms-1.5" /> {t("daily.print")}
              </Button>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-11 w-11 rounded-xl p-0"
              >
                <RefreshCw
                  size={18}
                  className={isFetching ? "animate-spin" : ""}
                />
              </Button>
            </div>
          }
        />
      </div>

      {/* Print-only title */}
      <div className="hidden print:block text-center">
        <h1 className="text-2xl font-black">{t("daily.printTitle", { date })}</h1>
      </div>

      {/* System Relations */}
      <PremiumCard
        noPadding
        className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/20 print:hidden"
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-main">{t("daily.relationsTitle")}</h3>
              <p className="text-[11px] font-bold text-muted">
                {t("daily.relationsSubtitle")}
              </p>
            </div>
            <Badge className="me-auto hidden sm:flex rounded-full border-primary/20 bg-primary-soft text-primary text-[10px] font-black">
              {t("daily.relationsBadge")}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {DAILY_SUMMARY_LINKS.map((l) => (
              <button
                key={l.label}
                onClick={() => navigate(l.href)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    l.iconBg,
                  )}
                >
                  <l.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-main flex items-center gap-1">
                    {t(l.label)}
                    <ArrowUpRight
                      size={12}
                      className="text-muted group-hover:text-primary"
                    />
                  </div>
                  <div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">
                    {t(l.desc)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          label={t("daily.statRevenue")}
          value={formatCurrency(Number(summary?.total_sales || 0))}
          icon={TrendingUp}
          variant="success"
          delay={0}
        />
        <StatCard
          label={t("daily.statNetProfit")}
          value={formatCurrency(net)}
          icon={Wallet}
          variant={net >= 0 ? "success" : "danger"}
          delay={0.05}
        />
        <StatCard
          label={t("daily.statInvoices")}
          value={formatNumber(summary?.invoice_count || 0)}
          icon={FileText}
          variant="info"
          delay={0.1}
        />
        <StatCard
          label={t("daily.statExpenses")}
          value={formatCurrency(Number(summary?.total_expenses || 0))}
          icon={ShoppingBag}
          variant="danger"
          delay={0.15}
        />
        <StatCard
          label={t("daily.statShifts")}
          value={formatNumber(summary?.shift_count || 0)}
          icon={Clock}
          variant="warning"
          delay={0.2}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        {/* Shifts Timeline */}
        <PremiumCard wrapperClassName="xl:col-span-2 min-w-0" className="p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black flex items-center gap-2">
              <UserCheck size={16} className="text-primary" />
              {t("daily.shiftsTitle")}
            </h3>
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft">
              {t("daily.shiftsBadge", { count: shifts.length })}
            </Badge>
          </div>

          {shifts.length === 0 ? (
            <EmptyState
              title={t("daily.noShiftsTitle")}
              message={t("daily.noShiftsMessage")}
              icon={Clock}
            />
          ) : (
            <div className="space-y-4">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="group relative pe-8 pb-4 border-e-2 border-border last:pb-0 last:border-0"
                >
                  <div className="absolute top-1 -right-2 h-4 w-4 rounded-full bg-primary border-4 border-card shadow-md group-hover:scale-125 transition-transform" />

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-soft/50 p-4 sm:p-5 rounded-2xl border border-border hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-card shadow-sm border border-border flex items-center justify-center text-primary font-black text-lg shrink-0">
                        {getShiftInitial(shift)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-main leading-tight truncate">
                          {getShiftDisplayName(shift)}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />{" "}
                            {parseBackendStamp(shift.opened_at)?.toLocaleTimeString(locale) ?? "—"}
                          </span>
                          {shift.closed_at && (
                            <span className="flex items-center gap-1 text-success">
                              <UserCheck size={12} />{" "}
                              {parseBackendStamp(shift.closed_at)?.toLocaleTimeString(locale) ?? "—"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className="px-4 py-2.5 rounded-xl bg-card shadow-sm border border-border">
                        <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-0.5">
                          {t("daily.sales")}
                        </p>
                        <p className="text-base font-black text-success">
                          {formatCurrency(Number(shift.total_sales || 0))}
                        </p>
                      </div>
                      <div className="px-4 py-2.5 rounded-xl bg-card shadow-sm border border-border">
                        <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-0.5">
                          {t("daily.invoices")}
                        </p>
                        <p className="text-base font-black text-main">
                          {formatNumber(shift.invoice_count || 0)}
                        </p>
                      </div>
                      <Badge
                        variant={shift.status === "open" ? "success" : "outline"}
                        className="rounded-xl font-black text-[10px]"
                      >
                        {shift.status === "open" ? t("daily.shiftOpen") : t("daily.shiftCompleted")}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PremiumCard>

        {/* Expenses Summary */}
        <PremiumCard className="p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black flex items-center gap-2">
              <ShoppingBag size={16} className="text-danger" />
              {t("daily.expensesTitle")}
            </h3>
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft">
              {t("daily.expensesBadge", { count: expenses.length })}
            </Badge>
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              title={t("daily.noExpensesTitle")}
              message={t("daily.noExpensesMessage")}
              icon={ShoppingBag}
            />
          ) : (
            <div className="space-y-3">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3.5 rounded-2xl bg-soft border border-border flex justify-between items-center gap-3 hover:border-danger/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-card shadow-sm border border-border flex items-center justify-center text-danger shrink-0">
                      <DollarSign size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-main leading-tight truncate">
                        {exp.description || t("daily.expenseFallback")}
                      </p>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5 truncate">
                        {exp.category || "---"}
                      </p>
                    </div>
                  </div>
                  <p className="text-base font-black text-danger shrink-0">
                    {formatCurrency(Number(exp.amount || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex justify-between items-center px-4 py-4 rounded-2xl bg-primary text-white shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                {t("daily.totalSpent")}
              </span>
              <span className="text-xl font-black tabular-nums">
                {formatCurrency(Number(summary?.total_expenses || 0))}
              </span>
            </div>
            <div className="mt-3 flex justify-between items-center px-4 py-4 rounded-2xl bg-soft border border-border">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                {t("daily.todayNet")}
              </span>
              <span
                className={cn(
                  "text-xl font-black tabular-nums",
                  net >= 0 ? "text-success" : "text-danger",
                )}
              >
                {formatCurrency(net)}
              </span>
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Footer Branding for Print */}
      <div className="hidden print:block text-center pt-20 border-t border-dashed mt-20 opacity-50">
        <p className="text-sm font-black">
          {t("daily.printFooter")}
        </p>
        <p className="text-[10px] font-bold mt-2 tracking-widest">
          {t("daily.extractedAt", { date: new Date().toLocaleString(locale) })}
        </p>
      </div>
    </div>
  );
};

export default DailySummaryReport;
