import { useCallback, useState } from "react";
import {
  BadgeDollarSign,
  Briefcase,
  CalendarDays,
  Medal,
  RefreshCw,
  Search,
  UserCheck,
  TrendingUp,
  Receipt,
  Building2,
  ArrowUpRight,
  Download,
  Star,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-hot-toast";
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
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { useEmployeePerformance } from "@/hooks/useApi";
import { TopPerformers, SYSTEM_LINKS, todayKey, firstDayOfMonth } from "@/features/reports";

export default function EmployeeReports() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayKey());
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error, refetch } = useEmployeePerformance({
    from_date: fromDate,
    to_date: toDate,
    page,
    page_size: 25,
    search: query,
  });

  const rows = data?.items || [];
  const summary = data?.summary;
  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  const handleFetch = useCallback(() => {
    setPage(1);
    refetch();
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (!rows.length) return toast.error("لا توجد بيانات للتصدير");
    const headers = ["الموظف", "المبيعات", "العمولة", "الخدمات", "الفواتير", "متوسط الفاتورة", "أكثر خدمة"];
    const rowsCsv = rows.map(r => [r.employee_name, r.sales, r.commission, r.service_count, r.invoice_count, r.avg_ticket, r.top_service_name]);
    const csv = [headers.join(","), ...rowsCsv.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `employee_reports_${fromDate}_${toDate}.csv`; link.click();
  }, [rows, fromDate, toDate]);

  return (
    <div className="erp-page space-y-6 pb-10" dir="rtl">
      <PageHeader
        title="تقارير الموظفين والعمولات"
        subtitle="تحليل مبيعات كل موظف وعدد الخدمات والعمولات — متكامل مع الفواتير والرواتب"
        badge="التقارير التشغيلية"
        icon={BadgeDollarSign}
        className={undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!rows.length} className="h-11 rounded-xl px-4 font-black border-border bg-card">
              <Download size={16} className="ml-1.5" /> تصدير CSV
            </Button>
            <Button onClick={handleFetch} disabled={isFetching} className="h-11 rounded-xl px-5">
              <RefreshCw size={16} className={isFetching ? "ml-1.5 animate-spin" : "ml-1.5"} /> تحديث
            </Button>
          </div>
        }
      />

      {/* System Relations */}
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/20">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary text-white flex items-center justify-center"><Building2 size={16} /></div>
            <div><h3 className="text-sm font-black text-main">ترابط التقارير بالنظام</h3><p className="text-[11px] font-bold text-muted">التقرير يجمع بين 4 وحدات أساسية</p></div>
            <Badge className="mr-auto hidden sm:flex rounded-full border-primary/20 bg-primary-soft text-primary text-[10px] font-black">تكامل لحظي</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map(l=>(
              <button key={l.label} onClick={()=>navigate(l.href)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-primary/40 hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", `bg-${l.color}`, `text-${l.color}-foreground`)}><l.icon size={18} /></div>
                <div className="min-w-0 flex-1"><div className="text-xs font-black text-main flex items-center gap-1">{l.label} <ArrowUpRight size={12} className="text-muted group-hover:text-primary" /></div><div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">{l.desc}</div></div>
              </button>
            ))}
          </div>
        </div>
      </PremiumCard>

      {/* Filters */}
      <PremiumCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs font-black text-muted uppercase tracking-widest mb-3">
          <CalendarDays size={14} className="text-primary" /> نطاق التقرير والبحث
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_auto]">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">من تاريخ</label>
            <Input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="h-11 rounded-xl bg-soft border-border font-bold" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">إلى تاريخ</label>
            <Input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="h-11 rounded-xl bg-soft border-border font-bold" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted uppercase">بحث موظف / خدمة</label>
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="مثال: أحمد - قص شعر..." className="h-11 pr-10 rounded-xl bg-soft border-border font-bold" />
            </div>
          </div>
          <div className="flex items-end">
            <Button onClick={handleFetch} disabled={isFetching} className="h-11 w-full xl:w-auto rounded-xl px-8">
              {isFetching ? <RefreshCw size={16} className="animate-spin" /> : "تطبيق"}
            </Button>
          </div>
        </div>
      </PremiumCard>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي المبيعات" value={formatCurrency(summary?.total_sales || 0)} icon={TrendingUp} variant="success" delay={0} />
        <StatCard label="إجمالي العمولات" value={formatCurrency(summary?.total_commission || 0)} icon={BadgeDollarSign} variant="warning" delay={0.05} />
        <StatCard label="عدد الخدمات" value={formatNumber(summary?.total_services || 0)} icon={Briefcase} variant="primary" delay={0.1} />
        <StatCard label="عدد الفواتير" value={formatNumber(summary?.total_invoices || 0)} icon={Receipt} variant="secondary" delay={0.15} />
      </div>

      {/* Top performers + Quick summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        <PremiumCard className="xl:col-span-7 p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black flex items-center gap-2"><Medal size={16} className="text-warning" /> أفضل الموظفين حسب المبيعات</h2>
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft">{rows.length} موظف</Badge>
          </div>
          {isLoading ? <div className="h-40 flex items-center justify-center"><RefreshCw className="animate-spin text-muted" /></div> : <TopPerformers rows={rows} />}
        </PremiumCard>
        <div className="xl:col-span-5 grid grid-cols-1 gap-4 min-w-0">
          <PremiumCard className="p-5 bg-gradient-to-br from-success to-success-strong text-white border-0">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0"><div className="text-[10px] font-black text-white/70 uppercase tracking-widest">أعلى موظف مبيعات</div><div className="mt-1 text-lg font-black truncate">{rows[0]?.employee_name || "-"}</div><div className="text-sm font-bold text-white/90">{rows[0] ? formatCurrency(rows[0].sales) : formatCurrency(0)}</div></div>
              <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Star size={20} /></div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-5">
            <div className="text-[10px] font-black text-muted uppercase">أكثر خدمة تكراراً عند الأعلى</div>
            <div className="mt-2 text-lg font-black text-main truncate">{rows[0]?.top_service_name || "-"}</div>
            <div className="text-xs font-bold text-muted mt-1">{rows[0] ? `${rows[0].service_count} خدمة` : "—"}</div>
          </PremiumCard>
          <PremiumCard className="p-5">
            <div className="text-[10px] font-black text-muted uppercase">متوسط مبيعات الموظف</div>
            <div className="mt-2 text-xl font-black text-main">{formatCurrency(rows.length ? (summary?.total_sales || 0) / rows.length : 0)}</div>
            <div className="text-xs font-bold text-muted">إجمالي {formatNumber(rows.length)} موظف</div>
          </PremiumCard>
        </div>
      </div>

      {/* Detailed Table - Responsive */}
      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-black flex items-center gap-2"><UserCheck size={16} className="text-primary" /> تفاصيل الموظفين والعمولات</h2>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="hidden sm:inline text-muted">يعرض</span>
            <Badge variant="primary" className="rounded-full">{rows.length} موظف</Badge>
            <span className="text-muted">•</span>
            <span className="text-muted">إجمالي {formatCurrency(summary?.total_sales || 0)}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted"><RefreshCw className="h-5 w-5 animate-spin" /> جاري تحميل التقرير...</div>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center p-8">
            <div className="h-14 w-14 rounded-2xl bg-soft border border-border flex items-center justify-center"><UserCheck size={20} className="text-muted/40" /></div>
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
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-black text-xs">{row.employee_name.charAt(0)}</div>
                          <span className="font-black text-main truncate">{row.employee_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 font-black text-success">{formatCurrency(row.sales)}</TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 font-black text-warning">{formatCurrency(row.commission)}</TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 text-center font-bold">{formatNumber(row.service_count)}</TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 text-center font-bold">{formatNumber(row.invoice_count)}</TableCell>
                      <TableCell className="px-4 py-4 sm:px-5 font-bold">{formatCurrency(row.avg_ticket)}</TableCell>
                      <TableCell className="px-4 py-4 sm:px-5"><Badge variant="outline" className="rounded-full bg-soft font-bold text-xs max-w-[140px] truncate">{row.top_service_name}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
              <AnimatePresence>
                {rows.map((row, idx) => (
                  <motion.div key={row.employee_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white font-black">{row.employee_name.charAt(0)}</div>
                        <div className="min-w-0"><div className="text-sm font-black truncate">{row.employee_name}</div><div className="text-[11px] font-bold text-muted truncate">{row.top_service_name}</div></div>
                      </div>
                      <Badge variant="success" className="rounded-full shrink-0">#{idx + 1}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-success-soft border border-success/20 p-3"><div className="text-[9px] font-black text-muted uppercase">المبيعات</div><div className="text-sm font-black text-success">{formatCurrency(row.sales)}</div></div>
                      <div className="rounded-xl bg-warning-soft border border-warning/20 p-3"><div className="text-[9px] font-black text-muted uppercase">العمولة</div><div className="text-sm font-black text-warning">{formatCurrency(row.commission)}</div></div>
                      <div className="rounded-xl bg-soft border border-border p-3 text-center"><div className="text-[9px] font-black text-muted uppercase">الخدمات</div><div className="font-black">{formatNumber(row.service_count)}</div></div>
                      <div className="rounded-xl bg-soft border border-border p-3 text-center"><div className="text-[9px] font-black text-muted uppercase">الفواتير</div><div className="font-black">{formatNumber(row.invoice_count)}</div></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-soft border border-border p-3">
                      <span className="text-[11px] font-bold text-muted">متوسط الفاتورة</span><span className="text-sm font-black">{formatCurrency(row.avg_ticket)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-muted">صفحة {page} من {totalPages} — إجمالي {data?.total || 0} موظف</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isFetching}>
                    <ChevronRight size={16} className="rotate-180" /> السابق
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || isFetching}>
                    التالي <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PremiumCard>
    </div>
  );
}


