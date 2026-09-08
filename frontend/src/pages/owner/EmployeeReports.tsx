import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Briefcase,
  CalendarDays,
  Medal,
  RefreshCw,
  Search,
  UserCheck,
  TrendingUp,
  Wallet,
  Receipt,
  Users,
  Building2,
  ArrowUpRight,
  Download,
  Clock,
  Star,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  StatCard as StatCardDisplay,
  CurrencyStatCard,
} from "@/components/shared/DisplayComponents";
import { cn, formatCurrency, asNumber as _asNumber } from "@/lib/core/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  PageHeader,
  PremiumCard,
} from "@/components/shared/PremiumUI";

function asNumber(value) { return _asNumber(value); }
function formatNumber(value) { return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(asNumber(value)); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function firstDayOfMonth(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10); }
function dateKey(value) { if (!value) return ""; try { return new Date(value).toISOString().slice(0, 10); } catch (err) { return String(value).slice(0, 10); } }
function invoiceDate(invoice) { return invoice?.created_at || invoice?.createdAt || invoice?.date || invoice?.invoice_date || invoice?.invoiceDate; }
function invoiceStatus(invoice) { return String(invoice?.status || invoice?.invoice_status || invoice?.invoiceStatus || "paid").toLowerCase(); }
function isRevenueInvoice(invoice) { return !["cancelled", "voided", "refunded", "deleted"].includes(invoiceStatus(invoice)); }
function invoiceItems(invoice) { if (Array.isArray(invoice?.items)) return invoice.items; if (Array.isArray(invoice?.invoice_items)) return invoice.invoice_items; if (Array.isArray(invoice?.lines)) return invoice.lines; if (Array.isArray(invoice?.services)) return invoice.services; return []; }
function invoiceTotal(invoice) { return asNumber(invoice?.total_amount ?? invoice?.totalAmount ?? invoice?.total ?? invoice?.net_total ?? invoice?.netTotal); }
function itemTotal(item) {
  const qty = asNumber(item?.quantity ?? item?.qty ?? 1) || 1;
  const unit = asNumber(item?.unit_price ?? item?.unitPrice ?? item?.price ?? item?.amount ?? 0);
  return asNumber(item?.total_price ?? item?.totalPrice ?? item?.line_total ?? item?.lineTotal ?? unit * qty);
}
function itemName(item) { return item?.service_name || item?.serviceName || item?.product_name || item?.productName || item?.name || item?.description || "بند"; }
function employeeIdFromInvoice(invoice, item) {
  return item?.employee_id || item?.employeeId || item?.barber_id || item?.barberId || item?.staff_id || item?.staffId || invoice?.employee_id || invoice?.employeeId || invoice?.barber_id || invoice?.barberId || invoice?.staff_id || invoice?.staffId || "unknown";
}
function employeeNameFromInvoice(invoice, item) {
  return item?.employee_name || item?.employeeName || item?.barber_name || item?.barberName || item?.staff_name || item?.staffName || invoice?.employee_name || invoice?.employeeName || invoice?.barber_name || invoice?.barberName || invoice?.staff_name || invoice?.staffName || "غير محدد";
}
function commissionRateFor(employee, item) {
  const raw = item?.commission_rate ?? item?.commissionRate ?? employee?.commission_rate ?? employee?.commissionRate ?? employee?.service_commission_rate ?? employee?.serviceCommissionRate ?? 0;
  const rate = asNumber(raw); if (rate > 1) return rate / 100; return rate;
}
function employeeDisplayName(employee) { return employee?.full_name || employee?.fullName || employee?.name || `${employee?.first_name || employee?.firstName || ""} ${employee?.last_name || employee?.lastName || ""}`.trim() || "موظف"; }
function employeeId(employee) { return employee?.id || employee?.employee_id || employee?.employeeId || employee?.user_id || employee?.userId; }

function buildEmployeeRows(invoices, employees) {
  const employeeMap = new Map();
  employees.forEach((employee) => { const id = String(employeeId(employee) || employeeDisplayName(employee)); employeeMap.set(id, employee); });
  const rows = new Map();
  invoices.filter(isRevenueInvoice).forEach((invoice) => {
    const items = invoiceItems(invoice);
    const effectiveItems = items.length ? items : [{ name: "فاتورة", total_price: invoiceTotal(invoice) }];
    effectiveItems.forEach((item) => {
      const id = String(employeeIdFromInvoice(invoice, item));
      const employee = employeeMap.get(id) || employeeMap.get(String(employeeNameFromInvoice(invoice, item))) || null;
      const name = employee ? employeeDisplayName(employee) : employeeNameFromInvoice(invoice, item);
      const rowKey = id === "unknown" ? name : id;
      const row = rows.get(rowKey) || { id: rowKey, name, invoices: new Set(), serviceCount: 0, sales: 0, commission: 0, avgTicket: 0, topService: new Map() };
      const total = itemTotal(item);
      const rate = commissionRateFor(employee, item);
      row.invoices.add(invoice?.id || invoice?.invoice_id || invoice?.invoiceNo || invoice?.invoice_no || Math.random());
      row.serviceCount += 1; row.sales += total; row.commission += total * rate;
      const serviceName = itemName(item);
      row.topService.set(serviceName, (row.topService.get(serviceName) || 0) + 1);
      rows.set(rowKey, row);
    });
  });
  return [...rows.values()].map((row) => {
    const top = [...row.topService.entries()].sort((a, b) => b[1] - a[1])[0];
    return { ...row, invoiceCount: row.invoices.size, avgTicket: row.invoices.size ? row.sales / row.invoices.size : 0, topServiceName: top?.[0] || "-" };
  }).sort((a, b) => b.sales - a.sales);
}

const SYSTEM_LINKS = [
  { label: "الموارد البشرية", icon: Users, desc: "بيانات الموظف والعمولة", color: "bg-indigo-500", href: "/owner/hr" },
  { label: "الفواتير", icon: Receipt, desc: "مصدر المبيعات والخدمات", color: "bg-emerald-500", href: "/invoices" },
  { label: "الرواتب", icon: Wallet, desc: "المستحقات والمكافآت", color: "bg-amber-500", href: "/owner/payroll" },
  { label: "الحضور", icon: Clock, desc: "الانضباط وتأثيره على الحافز", color: "bg-sky-500", href: "/attendance" },
];

function TopPerformers({ rows }) {
  const max = Math.max(...rows.map((r) => r.sales), 1);
  if (!rows.length) return <div className="rounded-2xl border border-dashed p-8 text-center text-sm font-bold text-muted">لا توجد بيانات موظفين في النطاق الحالي</div>;
  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row, index) => (
        <div key={row.id} className="flex items-center gap-3">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-xs", index === 0 ? "bg-amber-500 text-white" : index === 1 ? "bg-slate-400 text-white" : index === 2 ? "bg-amber-700 text-white" : "bg-soft text-muted border border-border")}>
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-black text-main">{row.name}</span>
              <span className="text-xs font-black text-emerald-600 whitespace-nowrap">{formatCurrency(row.sales)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-soft border border-border/50">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max((row.sales / max) * 100, 6)}%` }} transition={{ duration: 0.6, delay: index * 0.05 }} className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeReports() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayKey());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invoiceResponse, employeeResponse] = await Promise.allSettled([
        api.get("/invoices", { params: { from_date: fromDate, to_date: toDate, limit: 1000 } }),
        api.get("/employees", { params: { limit: 1000 } }),
      ]);
      if (invoiceResponse.status === "fulfilled") {
        const data = invoiceResponse.value.data;
        const items = Array.isArray(data) ? data : data.items || data.data || [];
        setInvoices(items);
      } else throw invoiceResponse.reason;
      if (employeeResponse.status === "fulfilled") setEmployees(adaptList(employeeResponse.value));
      else setEmployees([]);
    } catch (_error) {
      toast.error(getApiErrorMessage(_error, "فشل تحميل تقارير الموظفين"));
      setInvoices([]);
    } finally { setLoading(false); }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    const key = dateKey(invoiceDate(inv));
    if (fromDate && key && key < fromDate) return false;
    if (toDate && key && key > toDate) return false;
    return true;
  }), [invoices, fromDate, toDate]);

  const rows = useMemo(() => buildEmployeeRows(filteredInvoices, employees), [filteredInvoices, employees]);
  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => [row.name, row.topServiceName].join(" ").toLowerCase().includes(text));
  }, [rows, query]);

  const summary = useMemo(() => filteredRows.reduce((acc, row) => {
    acc.sales += row.sales; acc.commission += row.commission; acc.services += row.serviceCount; acc.invoices += row.invoiceCount; return acc;
  }, { sales: 0, commission: 0, services: 0, invoices: 0 }), [filteredRows]);

  const handleExport = () => {
    if (!filteredRows.length) return toast.error("لا توجد بيانات للتصدير");
    const headers = ["الموظف", "المبيعات", "العمولة", "الخدمات", "الفواتير", "متوسط الفاتورة", "أكثر خدمة"];
    const rowsCsv = filteredRows.map(r => [r.name, r.sales, r.commission, r.serviceCount, r.invoiceCount, r.avgTicket, r.topServiceName]);
    const csv = [headers.join(","), ...rowsCsv.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `employee_reports_${fromDate}_${toDate}.csv`; link.click();
  };

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
            <Button variant="outline" onClick={handleExport} className="h-11 rounded-xl px-4 font-black border-border bg-card">
              <Download size={16} className="ml-1.5" /> تصدير CSV
            </Button>
            <Button onClick={fetchData} disabled={loading} className="h-11 rounded-xl px-5 bg-slate-900 hover:bg-slate-800 text-white font-black">
              <RefreshCw size={16} className={loading ? "ml-1.5 animate-spin" : "ml-1.5"} /> تحديث
            </Button>
          </div>
        }
      />

      {/* System Relations */}
      <PremiumCard noPadding className="overflow-hidden border-dashed bg-gradient-to-br from-card via-card to-soft/20">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Building2 size={16} /></div>
            <div><h3 className="text-sm font-black text-main">ترابط التقارير بالنظام</h3><p className="text-[11px] font-bold text-muted">التقرير يجمع بين 4 وحدات أساسية</p></div>
            <Badge className="mr-auto hidden sm:flex rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-black">تكامل لحظي</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {SYSTEM_LINKS.map(l=>(
              <button key={l.label} onClick={()=>navigate(l.href)} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-right hover:border-slate-900 hover:shadow-md transition-all">
                <div className={cn("h-10 w-10 rounded-xl text-white flex items-center justify-center shrink-0", l.color)}><l.icon size={18} /></div>
                <div className="min-w-0 flex-1"><div className="text-xs font-black text-main flex items-center gap-1">{l.label} <ArrowUpRight size={12} className="text-muted group-hover:text-slate-900" /></div><div className="text-[10px] font-bold text-muted leading-tight mt-0.5 line-clamp-2">{l.desc}</div></div>
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
            <Button onClick={fetchData} disabled={loading} className="h-11 w-full xl:w-auto rounded-xl px-8 bg-slate-900 hover:bg-slate-800 text-white font-black">
              {loading ? <RefreshCw size={16} className="animate-spin" /> : "تطبيق"}
            </Button>
          </div>
        </div>
      </PremiumCard>

      {/* Stats */}
      <div data-stats-grid="true">
        <CurrencyStatCard label="إجمالي المبيعات" value={summary.sales} icon={TrendingUp} variant="success" trend={undefined} trendValue={undefined} hint={undefined} className={undefined} />
        <CurrencyStatCard label="إجمالي العمولات" value={summary.commission} icon={BadgeDollarSign} variant="warning" trend={undefined} trendValue={undefined} hint={undefined} className={undefined} />
        <StatCardDisplay label="عدد الخدمات" value={formatNumber(summary.services)} icon={Briefcase} variant="primary" trend={undefined} trendValue={undefined} hint={undefined} className={undefined} />
        <StatCardDisplay label="عدد الفواتير" value={formatNumber(summary.invoices)} icon={Receipt} variant="secondary" trend={undefined} trendValue={undefined} hint={undefined} className={undefined} />
      </div>

      {/* Top performers + Quick summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        <PremiumCard className="xl:col-span-7 p-5 sm:p-6 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black flex items-center gap-2"><Medal size={16} className="text-amber-600" /> أفضل الموظفين حسب المبيعات</h2>
            <Badge variant="outline" className="rounded-full text-[10px] font-black bg-soft">{filteredRows.length} موظف</Badge>
          </div>
          {loading ? <div className="h-40 flex items-center justify-center"><RefreshCw className="animate-spin text-muted" /></div> : <TopPerformers rows={filteredRows} />}
        </PremiumCard>
        <div className="xl:col-span-5 grid grid-cols-1 gap-4 min-w-0">
          <PremiumCard className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0"><div className="text-[10px] font-black text-white/70 uppercase tracking-widest">أعلى موظف مبيعات</div><div className="mt-1 text-lg font-black truncate">{filteredRows[0]?.name || "-"}</div><div className="text-sm font-bold text-white/90">{filteredRows[0] ? formatCurrency(filteredRows[0].sales) : formatCurrency(0)}</div></div>
              <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><Star size={20} /></div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-5">
            <div className="text-[10px] font-black text-muted uppercase">أكثر خدمة تكراراً عند الأعلى</div>
            <div className="mt-2 text-lg font-black text-main truncate">{filteredRows[0]?.topServiceName || "-"}</div>
            <div className="text-xs font-bold text-muted mt-1">{filteredRows[0] ? `${filteredRows[0].serviceCount} خدمة` : "—"}</div>
          </PremiumCard>
          <PremiumCard className="p-5">
            <div className="text-[10px] font-black text-muted uppercase">متوسط مبيعات الموظف</div>
            <div className="mt-2 text-xl font-black text-main">{formatCurrency(filteredRows.length ? summary.sales / filteredRows.length : 0)}</div>
            <div className="text-xs font-bold text-muted">إجمالي {formatNumber(filteredRows.length)} موظف</div>
          </PremiumCard>
        </div>
      </div>

      {/* Detailed Table - Responsive */}
      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-black flex items-center gap-2"><UserCheck size={16} className="text-primary" /> تفاصيل الموظفين والعمولات</h2>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="hidden sm:inline text-muted">يعرض</span>
            <Badge className="bg-slate-900 text-white rounded-full">{filteredRows.length} موظف</Badge>
            <span className="text-muted">•</span>
            <span className="text-muted">إجمالي {formatCurrency(summary.sales)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted"><RefreshCw className="h-5 w-5 animate-spin" /> جاري تحميل التقرير...</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center p-8">
            <div className="h-14 w-14 rounded-2xl bg-soft border border-border flex items-center justify-center"><UserCheck size={20} className="text-muted/40" /></div>
            <p className="mt-3 font-black text-main">لا توجد بيانات موظفين مطابقة</p>
            <p className="text-xs font-bold text-muted">جرب توسيع نطاق التاريخ أو مسح البحث</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[900px] text-right text-sm">
                <thead className="bg-soft/50 text-[10px] font-black uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-5 py-4">الموظف</th>
                    <th className="px-5 py-4">المبيعات</th>
                    <th className="px-5 py-4">العمولة</th>
                    <th className="px-5 py-4 text-center">الخدمات</th>
                    <th className="px-5 py-4 text-center">الفواتير</th>
                    <th className="px-5 py-4">متوسط الفاتورة</th>
                    <th className="px-5 py-4">أكثر خدمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-soft/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">{row.name.charAt(0)}</div>
                          <span className="font-black text-main">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-black text-emerald-600">{formatCurrency(row.sales)}</td>
                      <td className="px-5 py-4 font-black text-amber-600">{formatCurrency(row.commission)}</td>
                      <td className="px-5 py-4 text-center font-bold">{formatNumber(row.serviceCount)}</td>
                      <td className="px-5 py-4 text-center font-bold">{formatNumber(row.invoiceCount)}</td>
                      <td className="px-5 py-4 font-bold">{formatCurrency(row.avgTicket)}</td>
                      <td className="px-5 py-4"><Badge variant="outline" className="rounded-full bg-soft font-bold text-xs max-w-[140px] truncate">{row.topServiceName}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
              <AnimatePresence>
                {filteredRows.map((row, idx) => (
                  <motion.div key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">{row.name.charAt(0)}</div>
                        <div className="min-w-0"><div className="text-sm font-black truncate">{row.name}</div><div className="text-[11px] font-bold text-muted truncate">{row.topServiceName}</div></div>
                      </div>
                      <Badge className="bg-emerald-500 text-white rounded-full shrink-0">#{idx + 1}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><div className="text-[9px] font-black text-muted uppercase">المبيعات</div><div className="text-sm font-black text-emerald-700">{formatCurrency(row.sales)}</div></div>
                      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3"><div className="text-[9px] font-black text-muted uppercase">العمولة</div><div className="text-sm font-black text-amber-700">{formatCurrency(row.commission)}</div></div>
                      <div className="rounded-xl bg-soft border border-border p-3 text-center"><div className="text-[9px] font-black text-muted uppercase">الخدمات</div><div className="font-black">{formatNumber(row.serviceCount)}</div></div>
                      <div className="rounded-xl bg-soft border border-border p-3 text-center"><div className="text-[9px] font-black text-muted uppercase">الفواتير</div><div className="font-black">{formatNumber(row.invoiceCount)}</div></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-soft border border-border p-3">
                      <span className="text-[11px] font-bold text-muted">متوسط الفاتورة</span><span className="text-sm font-black">{formatCurrency(row.avgTicket)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </PremiumCard>
    </div>
  );
}


