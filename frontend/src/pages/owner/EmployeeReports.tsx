import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BadgeDollarSign,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Download,
  Receipt,
  RefreshCw,
  Search,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatNumber } from "@/lib/core/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PremiumCard, StatCard } from "@/components/shared/PremiumUI";
import { useEmployeePerformance } from "@/hooks/useApi";
import {
  Podium,
  SalesChart,
  SYSTEM_LINKS,
  LINK_COLORS,
  PRESET_OPTIONS,
  firstDayOfMonth,
  presetRange,
  todayKey,
  type ReportPreset,
} from "@/features/reports";

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 500;

export default function EmployeeReports() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayKey());
  const [preset, setPreset] = useState<ReportPreset>("month");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Debounce search to avoid an aggregation request per keystroke (server-side search)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const queryParams = {
    from_date: fromDate,
    to_date: toDate,
    search: debouncedQuery,
  };

  // Paginated rows for the table
  const { data, isLoading, isFetching, error, refetch } = useEmployeePerformance({
    ...queryParams,
    page,
    page_size: PAGE_SIZE,
  });

  // Top performers snapshot (always page 1) for the chart + podium
  const { data: topData, isLoading: topLoading } = useEmployeePerformance({
    ...queryParams,
    page: 1,
    page_size: 8,
  });

  const rows = data?.items || [];
  const summary = data?.summary;
  const topRows = topData?.items || [];
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));
  const avgPerEmployee =
    summary?.avg_sales_per_employee ??
    (data?.total ? Number(summary?.total_sales || 0) / data.total : 0);

  const applyPreset = useCallback((p: Exclude<ReportPreset, "custom">) => {
    const range = presetRange(p);
    setFromDate(range.from);
    setToDate(range.to);
    setPreset(p);
    setPage(1);
  }, []);

  const handleDateChange =
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setPreset("custom");
      setPage(1);
    };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = {
        from_date: fromDate,
        to_date: toDate,
        ...(debouncedQuery.trim() ? { search: debouncedQuery.trim() } : {}),
        page: 1,
        page_size: EXPORT_PAGE_SIZE,
      };
      const first = await api.get("/reports/employee-performance", { params });
      const total = first.data?.total || 0;
      let all = first.data?.items || [];
      const pages = Math.ceil(total / EXPORT_PAGE_SIZE);
      for (let p = 2; p <= pages; p++) {
        const res = await api.get("/reports/employee-performance", {
          params: { ...params, page: p },
        });
        all = all.concat(res.data?.items || []);
      }
      if (!all.length) return toast.error("لا توجد بيانات للتصدير");
      const headers = ["الموظف", "المبيعات", "العمولة", "نسبة العمولة", "الخدمات", "الفواتير", "متوسط الفاتورة", "أكثر خدمة"];
      const rowsCsv = all.map((r) => [r.employee_name, r.sales, r.commission, r.commission_rate ? `${(r.commission_rate * 100).toFixed(0)}%` : "—", r.service_count, r.invoice_count, r.avg_ticket, r.top_service_name]);
      const csv = [headers.join(","), ...rowsCsv.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `employee_reports_${fromDate}_${toDate}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`تم تصدير ${all.length} موظف بنجاح`);
    } catch (_err) {
      toast.error("فشل التصدير — حاول مجدداً");
    } finally {
      setExporting(false);
    }
  }, [fromDate, toDate, debouncedQuery]);

  return (
    <div className="erp-page space-y-4 sm:space-y-6 pb-10">
      {/* Hero — identity + headline totals + actions */}
      <PremiumCard
        noPadding
        className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-primary-strong text-white"
      >
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-20 right-1/4 h-40 w-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative p-5 sm:p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <BadgeDollarSign size={22} />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[10px] font-black tracking-widest">
                  التقارير التشغيلية
                </span>
                <h1 className="mt-2 text-xl sm:text-2xl font-black leading-tight">
                  تقارير الموظفين والعمولات
                </h1>
                <p className="mt-1 text-xs font-bold text-white/70">
                  من {fromDate} إلى {toDate} • {formatNumber(data?.total || 0)} موظف
                  {isFetching && !isLoading && " • جاري التحديث..."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                onClick={handleExport}
                disabled={!rows.length || exporting}
                className="h-11 rounded-xl px-4 font-black bg-white text-primary hover:bg-white/90"
              >
                {exporting ? (
                  <RefreshCw size={16} className="ml-1.5 animate-spin" />
                ) : (
                  <Download size={16} className="ml-1.5" />
                )}
                تصدير CSV
              </Button>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-11 w-11 rounded-xl p-0 bg-white/15 text-white border border-white/20 hover:bg-white/25"
              >
                <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-white/70 uppercase tracking-widest">
                <TrendingUp size={12} /> إجمالي مبيعات الفترة
              </div>
              <div className="mt-1 text-3xl sm:text-4xl font-black tabular-nums truncate">
                {formatCurrency(Number(summary?.total_sales || 0))}
              </div>
            </div>
            <div className="hidden sm:block w-px self-stretch bg-white/20 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                إجمالي العمولات
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-black tabular-nums truncate">
                {formatCurrency(Number(summary?.total_commission || 0))}
              </div>
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* Error State */}
      {error && !isLoading && (
        <PremiumCard className="p-4 border-danger/20 bg-danger-soft">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-danger shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-danger">حدث خطأ في تحميل البيانات</p>
              <p className="text-xs font-bold text-muted mt-0.5">
                تعذّر الاتصال بالخادم — تحقق من الاتصال ثم أعد المحاولة
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="shrink-0 rounded-xl"
            >
              <RefreshCw size={14} className="ml-1" /> إعادة المحاولة
            </Button>
          </div>
        </PremiumCard>
      )}

      {/* Filters — presets + dates + search */}
      <PremiumCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-black text-muted uppercase tracking-widest mb-3">
          <CalendarDays size={14} className="text-primary" /> نطاق التقرير والبحث
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">الفترة</label>
            <div className="flex h-11 items-center rounded-xl bg-soft border border-border p-1 gap-1">
              {PRESET_OPTIONS.filter((o) => o.value !== "custom").map((o) => (
                <button
                  key={o.value}
                  onClick={() => applyPreset(o.value as Exclude<ReportPreset, "custom">)}
                  className={cn(
                    "h-full flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-black transition-all",
                    preset === o.value
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted hover:text-main",
                  )}
                >
                  {o.label}
                </button>
              ))}
              {preset === "custom" && (
                <span className="h-full flex items-center whitespace-nowrap rounded-lg px-3 text-xs font-black bg-card text-primary shadow-sm">
                  مخصص
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">من تاريخ</label>
            <Input
              type="date"
              value={fromDate}
              onChange={handleDateChange(setFromDate)}
              className="h-11 rounded-xl bg-soft border-border font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">إلى تاريخ</label>
            <Input
              type="date"
              value={toDate}
              onChange={handleDateChange(setToDate)}
              className="h-11 rounded-xl bg-soft border-border font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">بحث موظف / خدمة</label>
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="مثال: أحمد - قص شعر..."
                className="h-11 pr-10 rounded-xl bg-soft border-border font-bold"
              />
            </div>
          </div>
        </div>
      </PremiumCard>

      {/* KPIs — no overlap with hero totals */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="عدد الموظفين"
          value={formatNumber(data?.total || 0)}
          icon={Users}
          variant="primary"
          delay={0}
        />
        <StatCard
          label="عدد الخدمات"
          value={formatNumber(summary?.total_services || 0)}
          icon={Briefcase}
          variant="info"
          delay={0.05}
        />
        <StatCard
          label="عدد الفواتير"
          value={formatNumber(summary?.total_invoices || 0)}
          icon={Receipt}
          variant="secondary"
          delay={0.1}
        />
        <StatCard
          label="متوسط مبيعات الموظف"
          value={formatCurrency(Number(avgPerEmployee) || 0)}
          icon={Wallet}
          variant="warning"
          delay={0.15}
        />
      </div>

      {/* Chart + Podium */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        <PremiumCard wrapperClassName="xl:col-span-7 min-w-0" className="p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" /> مقارنة المبيعات
            </h2>
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft">
              الأعلى 8
            </Badge>
          </div>
          {topLoading ? (
            <div className="h-[280px] sm:h-[320px] flex items-center justify-center">
              <RefreshCw className="animate-spin text-muted" />
            </div>
          ) : (
            <SalesChart rows={topRows} />
          )}
        </PremiumCard>
        <PremiumCard wrapperClassName="xl:col-span-5 min-w-0" className="p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black flex items-center gap-2">
              <Trophy size={16} className="text-warning" /> منصة الأوائل
            </h2>
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft">
              Top 3
            </Badge>
          </div>
          {topLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <RefreshCw className="animate-spin text-muted" />
            </div>
          ) : (
            <Podium rows={topRows} />
          )}
        </PremiumCard>
      </div>

      {/* Detailed Table — responsive */}
      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-black flex items-center gap-2">
            <UserCheck size={16} className="text-primary" /> تفاصيل الموظفين والعمولات
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="hidden sm:inline text-muted">يعرض</span>
            <Badge variant="primary" className="rounded-full">
              {rows.length} من {data?.total || 0}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted">
            <RefreshCw className="h-5 w-5 animate-spin" /> جاري تحميل التقرير...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center p-8">
            <div className="h-14 w-14 rounded-2xl bg-soft border border-border flex items-center justify-center">
              <UserCheck size={20} className="text-muted/40" />
            </div>
            <p className="mt-3 font-black text-main">لا توجد بيانات موظفين مطابقة</p>
            <p className="text-xs font-bold text-muted">جرب توسيع نطاق التاريخ أو مسح البحث</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-soft/50 text-[10px] font-black uppercase tracking-widest text-muted">
                    <TableHead className="px-4 py-4 sm:px-5">الموظف</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">المبيعات</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">العمولة</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5 text-center">الخدمات</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5 text-center">الفواتير</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">متوسط الفاتورة</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">أكثر خدمة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {rows.map((row) => (
                    <TableRow key={row.employee_id} className="hover:bg-soft/30 transition-colors">
                      <TableCell className="px-4 py-4 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-black text-xs">
                            {row.employee_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-main truncate">{row.employee_name}</div>
                            {row.job_title && (
                              <div className="text-[10px] font-bold text-muted truncate">
                                {row.job_title}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 font-black text-success">
                        {formatCurrency(row.sales)}
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5">
                        <div className="font-black text-warning">{formatCurrency(row.commission)}</div>
                        {row.commission_rate ? (
                          <div className="text-[10px] font-bold text-muted mt-0.5">
                            النسبة {(row.commission_rate * 100).toFixed(0)}%
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 text-center font-bold">
                        {formatNumber(row.service_count)}
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 text-center font-bold">
                        {formatNumber(row.invoice_count)}
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 font-bold">
                        {formatCurrency(row.avg_ticket)}
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5">
                        <Badge
                          variant="outline"
                          className="rounded-full bg-soft font-bold text-xs max-w-[140px] truncate"
                        >
                          {row.top_service_name}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile Cards — global rank across pages */}
            <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
              <AnimatePresence>
                {rows.map((row, idx) => {
                  const rank = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <motion.div
                      key={row.employee_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-black">
                            {row.employee_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black truncate">{row.employee_name}</div>
                            {row.job_title && (
                              <div className="text-[10px] font-bold text-muted truncate">
                                {row.job_title}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="success" className="rounded-full shrink-0">
                          #{rank}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-success-soft border border-success/20 p-3">
                          <div className="text-[9px] font-black text-muted uppercase">المبيعات</div>
                          <div className="text-sm font-black text-success">
                            {formatCurrency(row.sales)}
                          </div>
                        </div>
                        <div className="rounded-xl bg-warning-soft border border-warning/20 p-3">
                          <div className="text-[9px] font-black text-muted uppercase">العمولة</div>
                          <div className="text-sm font-black text-warning">
                            {formatCurrency(row.commission)}
                          </div>
                          {row.commission_rate && (
                            <div className="text-[9px] font-bold text-warning/70 mt-0.5">
                              {(row.commission_rate * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl bg-soft border border-border p-3 text-center">
                          <div className="text-[9px] font-black text-muted uppercase">الخدمات</div>
                          <div className="font-black">{formatNumber(row.service_count)}</div>
                        </div>
                        <div className="rounded-xl bg-soft border border-border p-3 text-center">
                          <div className="text-[9px] font-black text-muted uppercase">الفواتير</div>
                          <div className="font-black">{formatNumber(row.invoice_count)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-soft border border-border p-3">
                        <span className="text-[11px] font-bold text-muted">متوسط الفاتورة</span>
                        <span className="text-sm font-black">{formatCurrency(row.avg_ticket)}</span>
                      </div>
                      {row.top_service_name && (
                        <div className="mt-2 flex items-center justify-between rounded-xl bg-soft border border-border p-3">
                          <span className="text-[11px] font-bold text-muted">أكثر خدمة</span>
                          <Badge
                            variant="outline"
                            className="rounded-full font-bold text-[10px] max-w-[140px] truncate"
                          >
                            {row.top_service_name}
                          </Badge>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-sm font-bold text-muted">
                  صفحة {page} من {totalPages} — إجمالي {data?.total || 0} موظف
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                  >
                    <ChevronRight size={16} className="rotate-180" /> السابق
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isFetching}
                  >
                    التالي <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PremiumCard>

      {/* Quick links strip */}
      <PremiumCard className="p-3 sm:p-4 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black text-muted uppercase tracking-widest shrink-0">
            روابط سريعة:
          </span>
          {SYSTEM_LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => navigate(l.href)}
              className="group flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-1.5 pl-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  LINK_COLORS[l.color],
                )}
              >
                <l.icon size={14} />
              </span>
              <span className="text-xs font-black text-main group-hover:text-primary">
                {l.label}
              </span>
            </button>
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
