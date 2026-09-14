import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  Clock,
  CreditCard,
  Eye,
  FileSpreadsheet,
  Filter,
  History,
  Package,
  Printer,
  Search,
  ShieldCheck,
  Wallet,
  X,
  TrendingUp,
} from "lucide-react";
import expenseService from "@/features/expenses/services/expenseService";
import exportService from "@/services/exportService";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { formatCurrency } from "@/lib/core/utils";

const CATEGORIES = [
  { value: "all", label: "الكل" },
  { value: "رواتب", label: "رواتب" },
  { value: "إيجار", label: "إيجار" },
  { value: "مشتريات", label: "مشتريات" },
  { value: "كهرباء", label: "كهرباء" },
  { value: "مياه", label: "مياه" },
  { value: "إنترنت", label: "إنترنت" },
  { value: "صيانة", label: "صيانة" },
  { value: "تسويق", label: "تسويق" },
  { value: "ضيافة", label: "ضيافة" },
  { value: "أخرى", label: "أخرى" },
];

const PAYMENT_METHODS = [
  { value: "all", label: "الكل" },
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة" },
];

const LIMITS = [20, 50, 100];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
  wallet: "محفظة",
};

function paymentLabel(v: unknown): string {
  const k = String(v || "").trim().toLowerCase();
  return PAYMENT_LABELS[k] || (k ? k : "—");
}

function getStatusLabel(status: unknown): string {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "معتمد";
  if (s === "recorded") return "مسجل";
  if (s === "cancelled" || s === "canceled") return "ملغي";
  return s ? s : "غير محدد";
}

function getStatusVariant(status: unknown): "success" | "danger" | "secondary" | "warning" {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "cancelled" || s === "canceled") return "danger";
  if (s === "recorded") return "warning";
  return "secondary";
}

type ArchiveFilters = {
  start_date: string;
  end_date: string;
  category: string;
  payment_method: string;
  q: string;
  page: number;
  limit: number;
  sortBy: "date" | "amount";
  sortDir: "asc" | "desc";
};

const DEFAULT_FILTERS: ArchiveFilters = {
  start_date: "",
  end_date: "",
  category: "all",
  payment_method: "all",
  q: "",
  page: 1,
  limit: 20,
  sortBy: "date",
  sortDir: "desc",
};

function buildCleanParams(filters: ArchiveFilters): Record<string, unknown> {
  const skip = (Math.max(1, filters.page) - 1) * filters.limit;
  const out: Record<string, unknown> = {
    skip,
    limit: filters.limit,
  };
  if (filters.start_date) out.start_date = filters.start_date;
  if (filters.end_date) out.end_date = filters.end_date;
  if (filters.category && filters.category !== "all") out.category = filters.category;
  if (filters.payment_method && filters.payment_method !== "all") out.payment_method = filters.payment_method;
  if (filters.q && String(filters.q).trim()) out.q = String(filters.q).trim();
  // also support backend alias 'search' for compatibility
  if (filters.q && String(filters.q).trim()) out.search = String(filters.q).trim();
  return out;
}

export default function ExpensesArchive() {
  const navigate = useNavigate();
  const [items, setItems] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ArchiveFilters>(DEFAULT_FILTERS);
  const [qDraft, setQDraft] = useState("");
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);
  const [openDetail, setOpenDetail] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => (prev.q === qDraft.trim() ? prev : { ...prev, q: qDraft, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [qDraft]);

  const fetchArchive = useCallback(async (activeFilters: ArchiveFilters) => {
    setLoading(true);
    try {
      const params = buildCleanParams(activeFilters);
      const response = (await expenseService.archive(params as never)) as unknown as Record<string, unknown>;
      const normalizedItems = Array.isArray((response as Record<string, unknown>)?.items) ? ((response as Record<string, unknown>).items as unknown[]) : Array.isArray(response) ? (response as unknown[]) : [];
      setItems(normalizedItems);
      setTotal(Number((response as Record<string, unknown>)?.total ?? normalizedItems.length ?? 0));
      const amt = Number((response as Record<string, unknown>)?.total_amount ?? (response as Record<string, unknown>)?.totalAmount ?? 0);
      if (amt) setTotalAmount(amt);
      else {
        // fallback: sum of current page if backend doesn't return total_amount
        const sum = normalizedItems.reduce((s: number, it: unknown) => s + Number((it as Record<string, unknown>)?.amount || 0), 0);
        // only use fallback when not paginated beyond first page? keep as is for display
        if (normalizedItems.length > 0 && total === 0) setTotalAmount(sum);
        else if (normalizedItems.length === 0) setTotalAmount(0);
        else if (amt === 0 && normalizedItems.length > 0) {
          // if backend didn't return total_amount, estimate from page sum when filtering narrowly
          // keep previous totalAmount if we have no reliable total
        }
      }
      // if backend returned total_amount reliably, use it; otherwise compute from all items if we have them
      if (Number((response as Record<string, unknown>)?.total_amount) > 0) setTotalAmount(Number((response as Record<string, unknown>).total_amount));
    } catch {
      toast.error("فشل تحميل أرشيف المصروفات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchive(filters);
  }, [fetchArchive, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / filters.limit)), [total, filters.limit]);

  const sortedItems = useMemo(() => {
    const rows = [...(items as Array<Record<string, unknown>>)];
    rows.sort((a, b) => {
      if (filters.sortBy === "amount") {
        const av = Number(a.amount || 0);
        const bv = Number(b.amount || 0);
        return filters.sortDir === "asc" ? av - bv : bv - av;
      }
      const av = new Date(String(a.expense_date || a.created_at || 0)).getTime() || 0;
      const bv = new Date(String(b.expense_date || b.created_at || 0)).getTime() || 0;
      return filters.sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [items, filters.sortBy, filters.sortDir]);

  const kpis = useMemo(() => {
    const rows = items as Array<Record<string, unknown>>;
    const sumPage = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const avg = rows.length ? sumPage / rows.length : 0;
    // totalAmount from backend is more accurate for whole filtered set; use it if available
    const displayTotal = totalAmount > 0 ? totalAmount : sumPage;
    return { displayTotal, count: total, pageCount: rows.length, avg };
  }, [items, total, totalAmount]);

  const handleReset = () => {
    setQDraft("");
    setFilters({ ...DEFAULT_FILTERS });
  };

  const handlePrint = () => window.print();

  const toggleSort = (key: "date" | "amount") => {
    setFilters((p) => {
      if (p.sortBy === key) return { ...p, sortDir: p.sortDir === "asc" ? "desc" : "asc" };
      return { ...p, sortBy: key, sortDir: key === "amount" ? "desc" : "desc" };
    });
  };

  return (
    <div className="erp-page-container space-y-6 pb-10" dir="rtl">
      <PageHeader
        title="أرشيف المصروفات"
        subtitle="السجل التاريخي للمصروفات — فلترة زمنية، بحث فوري، وتصدير"
        badge="الأرشيف المالي"
        icon={Archive}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" onClick={() => exportService.downloadExcel("/exports/expenses/archive/excel", "expenses_archive", buildCleanParams(filters) as Record<string, unknown>)} className="h-11 rounded-xl px-4 font-black text-xs">
              <FileSpreadsheet size={16} className="ml-1.5" /> Excel
            </Button>
            <Button variant="outline" onClick={handlePrint} className="h-11 rounded-xl px-4 font-black text-xs">
              <Printer size={16} className="ml-1.5" /> طباعة / PDF
            </Button>
            <Link to="/expenses">
              <Button variant="ghost" className="h-11 rounded-xl border border-border bg-card px-4 font-black text-xs">
                <ArrowRight size={16} className="ml-1.5" /> العودة للمصروفات
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PremiumCard className="p-5" animate={false}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2"><Wallet size={12} className="text-primary" /> إجمالي إنفاق الفترة</div>
          <div className="mt-2 text-2xl font-black tabular-nums">{formatCurrency(kpis.displayTotal)}</div>
          <div className="text-[11px] font-bold text-muted">{kpis.count} عملية • الفترة المفلترة</div>
        </PremiumCard>
        <PremiumCard className="p-5" animate={false}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2"><History size={12} className="text-sky-600" /> عدد العمليات</div>
          <div className="mt-2 text-2xl font-black tabular-nums">{kpis.count}</div>
          <div className="text-[11px] font-bold text-muted">{kpis.pageCount} في الصفحة الحالية</div>
        </PremiumCard>
        <PremiumCard className="p-5" animate={false}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2"><TrendingUp size={12} className="text-emerald-600" /> متوسط المصروف</div>
          <div className="mt-2 text-2xl font-black tabular-nums">{formatCurrency(kpis.avg)}</div>
          <div className="text-[11px] font-bold text-muted">للفترة المفلترة</div>
        </PremiumCard>
      </div>

      {/* Filters */}
      <PremiumCard noPadding className="overflow-hidden" animate={false}>
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Filter size={14} /></div>
            <div>
              <h3 className="text-sm font-black">فلاتر البحث المتقدم</h3>
              <p className="text-[11px] font-bold text-muted">نطاق زمني + تصنيف + طريقة دفع — البحث يحدّث تلقائياً</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset} className="mr-auto h-8 rounded-xl text-xs font-black gap-1"><X size={12} /> إعادة ضبط</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="من تاريخ">
              <Input type="date" value={filters.start_date} max={filters.end_date || undefined} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value, page: 1 }))} className="h-11 rounded-xl bg-soft border-border font-bold" />
            </Field>
            <Field label="إلى تاريخ">
              <Input type="date" value={filters.end_date} min={filters.start_date || undefined} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value, page: 1 }))} className="h-11 rounded-xl bg-soft border-border font-bold" />
            </Field>
            <Field label="التصنيف">
              <Select value={filters.category} onValueChange={(v) => setFilters((p) => ({ ...p, category: v, page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="طريقة الدفع">
              <Select value={filters.payment_method} onValueChange={(v) => setFilters((p) => ({ ...p, payment_method: v, page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Field label="بحث في العنوان أو الوصف">
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="مثال: إيجار، كهرباء، صيانة..." className="h-11 pr-9 rounded-xl bg-soft border-border font-bold" />
                  {qDraft && <button onClick={() => setQDraft("")} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border flex items-center justify-center text-muted"><X size={12} /></button>}
                </div>
              </Field>
            </div>
            <Field label="عدد الصفوف">
              <Select value={String(filters.limit)} onValueChange={(v) => setFilters((p) => ({ ...p, limit: Number(v), page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent>{LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n} / صفحة</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>

          {filters.start_date && filters.end_date && filters.start_date > filters.end_date && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">تاريخ البداية أكبر من النهاية — سيتم تجاهل النطاق حتى تصححه</div>
          )}

          <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
            <span className="hidden sm:inline">النتائج تحدّث تلقائياً • </span>
            <span>{total} عملية • صفحة {filters.page} من {totalPages}</span>
            <span className="mr-auto hidden sm:inline-flex items-center gap-1">ترتيب حسب {filters.sortBy === "amount" ? "المبلغ" : "التاريخ"} {filters.sortDir === "asc" ? "↑" : "↓"}</span>
          </div>
        </div>
      </PremiumCard>

      {/* Table */}
      <Card className="overflow-hidden rounded-[24px] border-border bg-card p-0 shadow-soft">
        {loading ? (
          <div className="p-6 space-y-3">
            <SkeletonCard variant="stats" />
            <SkeletonCard variant="stats" />
            <SkeletonCard variant="stats" />
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right">
                <thead className="sticky top-0 z-10 bg-soft/70 backdrop-blur border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">
                      <button onClick={() => toggleSort("date")} className="flex items-center gap-1">التاريخ {filters.sortBy === "date" ? (filters.sortDir === "asc" ? "↑" : "↓") : ""}</button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">المصروف</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">التصنيف</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">
                      <button onClick={() => toggleSort("amount")} className="flex items-center gap-1">المبلغ {filters.sortBy === "amount" ? (filters.sortDir === "asc" ? "↑" : "↓") : ""}</button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">طريقة الدفع</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الحالة</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted print:hidden">عرض</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedItems.map((item) => {
                    const r = item as Record<string, unknown>;
                    return (
                      <tr key={String(r.id)} className="hover:bg-soft/20 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold tabular-nums">{r.expense_date ? new Date(String(r.expense_date)).toLocaleDateString("ar-EG") : r.created_at ? new Date(String(r.created_at)).toLocaleDateString("ar-EG") : "—"}</td>
                        <td className="px-6 py-4"><div className="text-sm font-black truncate max-w-[260px]">{String(r.title || r.name || "مصروف")}</div><div className="text-[11px] font-bold text-muted truncate max-w-[260px]">{String(r.description || "—")}</div></td>
                        <td className="px-6 py-4"><Badge variant="outline" className="rounded-full font-black text-[11px]">{String(r.category || "غير محدد")}</Badge></td>
                        <td className="px-6 py-4 text-sm font-black tabular-nums">{formatCurrency(r.amount)}</td>
                        <td className="px-6 py-4 text-xs font-bold flex items-center gap-1"><CreditCard size={12} className="text-muted" />{paymentLabel(r.payment_method)}</td>
                        <td className="px-6 py-4"><Badge variant={getStatusVariant(r.status) as never} className="rounded-full text-[10px] font-black">{getStatusLabel(r.status)}</Badge></td>
                        <td className="px-6 py-4 text-center print:hidden">
                          <Button variant="ghost" size="icon" onClick={() => { setDetailItem(r); setOpenDetail(true); }} className="h-8 w-8 rounded-xl border bg-card hover:bg-soft">
                            <Eye size={14} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedItems.length === 0 && (
                    <tr><td colSpan={7} className="py-20 text-center"><History size={40} className="mx-auto text-muted/20 mb-3" /><p className="text-sm font-black">لا توجد نتائج مطابقة</p><p className="text-[11px] font-bold text-muted">جرّب توسيع النطاق أو مسح البحث</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden p-4 grid grid-cols-1 gap-3">
              {sortedItems.map((item) => {
                const r = item as Record<string, unknown>;
                return (
                  <PremiumCard key={String(r.id)} className="p-4 space-y-3" animate={false} hoverable={false}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-soft border flex items-center justify-center text-muted shrink-0"><Package size={16} /></div>
                        <div className="min-w-0"><div className="text-sm font-black truncate">{String(r.title || "مصروف")}</div><div className="text-[11px] font-bold text-muted truncate">{String(r.category || "—")} • {r.expense_date ? new Date(String(r.expense_date)).toLocaleDateString("ar-EG") : "—"}</div></div>
                      </div>
                      <Badge variant={getStatusVariant(r.status) as never} className="shrink-0 rounded-full text-[10px]">{getStatusLabel(r.status)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-soft border p-3"><div className="text-[9px] font-black text-muted uppercase">المبلغ</div><div className="font-black tabular-nums">{formatCurrency(r.amount)}</div></div>
                      <div className="rounded-xl bg-soft border p-3"><div className="text-[9px] font-black text-muted uppercase">الدفع</div><div className="font-black text-xs">{paymentLabel(r.payment_method)}</div></div>
                    </div>
                    <Button variant="outline" onClick={() => { setDetailItem(r); setOpenDetail(true); }} className="w-full h-9 rounded-xl text-xs font-black">عرض التفاصيل</Button>
                  </PremiumCard>
                );
              })}
              {sortedItems.length === 0 && <div className="py-10 text-center font-bold text-muted">لا توجد نتائج</div>}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border p-4 bg-soft/20 print:hidden">
              <Button variant="outline" disabled={filters.page <= 1 || loading} onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} className="h-9 rounded-xl font-black w-full sm:w-auto">السابق</Button>
              <div className="flex items-center gap-2 text-xs font-bold text-muted">
                <span>صفحة {filters.page} من {totalPages}</span><span className="hidden sm:inline">•</span><span>{total} عملية</span>
                <Select value={String(filters.limit)} onValueChange={(v) => setFilters((p) => ({ ...p, limit: Number(v), page: 1 }))}>
                  <SelectTrigger className="h-8 w-24 rounded-xl bg-card text-xs font-black"><SelectValue /></SelectTrigger>
                  <SelectContent>{LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="outline" disabled={filters.page >= totalPages || loading} onClick={() => setFilters((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }))} className="h-9 rounded-xl font-black w-full sm:w-auto">التالي</Button>
            </div>
          </>
        )}
      </Card>

      {/* Detail dialog */}
      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent dir="rtl" className="max-w-lg rounded-[24px] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
            <div className="relative flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10"><Package size={20} /></div>
              <div>
                <DialogTitle className="text-lg font-black text-white">تفاصيل المصروف</DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-300">قراءة فقط • الأرشيف</DialogDescription>
              </div>
              <div className="mr-auto"><Badge variant={detailItem ? getStatusVariant(detailItem.status) as never : "secondary"} className="rounded-full bg-white/10 text-white border-white/10">{detailItem ? getStatusLabel(detailItem.status) : ""}</Badge></div>
            </div>
          </div>
          {detailItem ? (
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Creator */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                  {String(((detailItem.created_by as Record<string, unknown>)?.full_name as string) || ((detailItem.created_by_user as Record<string, unknown>)?.full_name as string) || (detailItem.recipient_name as string) || "؟")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black truncate">{String(((detailItem.created_by as Record<string, unknown>)?.full_name as string) || ((detailItem.created_by_user as Record<string, unknown>)?.full_name as string) || ((detailItem.created_by as Record<string, unknown>)?.username as string) || "غير معروف")}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="h-5 rounded-full px-2 text-[9px] font-black border-0 bg-slate-900 text-white">{String(((detailItem.created_by as Record<string, unknown>)?.role || (detailItem.created_by_user as Record<string, unknown>)?.role || "موظف"))}</Badge>
                    <span className="text-[11px] font-bold text-muted flex items-center gap-1"><Clock size={10} />{detailItem.created_at ? new Date(String(detailItem.created_at)).toLocaleDateString("ar-EG") : "—"}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-muted">المنشئ</span>
              </div>

              <div className="rounded-2xl bg-soft border p-4 space-y-2">
                <div className="text-sm font-black">{String(detailItem.title || detailItem.name || "مصروف")}</div>
                <div className="text-xs font-bold text-muted whitespace-pre-wrap leading-relaxed">{String(detailItem.description || "لا يوجد وصف")}</div>
                {detailItem.recipient_name ? <div className="text-xs font-black text-main mt-2">المستفيد: <span className="font-bold text-muted">{String(detailItem.recipient_name)}</span></div> : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft border p-4"><div className="text-[9px] font-black text-muted uppercase">التاريخ</div><div className="text-sm font-black">{detailItem.expense_date ? new Date(String(detailItem.expense_date)).toLocaleDateString("ar-EG") : detailItem.created_at ? new Date(String(detailItem.created_at)).toLocaleDateString("ar-EG") : "—"}</div></div>
                <div className="rounded-2xl bg-soft border p-4"><div className="text-[9px] font-black text-muted uppercase">المبلغ</div><div className="text-sm font-black tabular-nums">{formatCurrency(detailItem.amount)}</div></div>
                <div className="rounded-2xl bg-soft border p-4"><div className="text-[9px] font-black text-muted uppercase">التصنيف</div><div className="text-sm font-black">{String(detailItem.category || "—")}</div></div>
                <div className="rounded-2xl bg-soft border p-4"><div className="text-[9px] font-black text-muted uppercase">طريقة الدفع</div><div className="text-sm font-black flex items-center gap-1"><CreditCard size={12} />{paymentLabel(detailItem.payment_method)}</div></div>
              </div>

              {(detailItem.reference_type || detailItem.reference_id) ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                  <div className="text-[10px] font-black text-indigo-700 uppercase flex items-center gap-2"><ArrowUpRight size={12} /> مرتبط بـ</div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600 text-white rounded-full text-[10px] font-black">{String(detailItem.reference_type)}</Badge>
                    <span className="font-black text-sm">#{String(detailItem.reference_id)}</span>
                    <button onClick={() => {
                      const t = String(detailItem.reference_type);
                      if (t === "payroll") navigate("/owner/payroll");
                      else if (t === "invoice") navigate("/invoices");
                      else if (t === "product") navigate("/inventory");
                      else if (t === "booking") navigate("/bookings");
                    }} className="mr-auto text-xs font-black text-indigo-600 hover:underline">فتح المرجع</button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border bg-soft/30 p-3 flex items-center gap-2">
                <Wallet size={14} className="text-muted" />
                <span className="text-xs font-bold text-muted">حركة الخزنة:</span>
                <span className="font-black text-xs">EXP-{String(detailItem.id)}</span>
                <button onClick={() => navigate("/owner/cashbox")} className="mr-auto text-xs font-black text-primary hover:underline">عرض في الخزنة</button>
              </div>

              {detailItem.internal_notes && String(detailItem.internal_notes).trim() ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-[10px] font-black text-amber-700 uppercase flex items-center gap-1"><ShieldCheck size={12} /> ملاحظات داخلية</div>
                  <p className="text-sm font-bold leading-relaxed text-amber-900 whitespace-pre-wrap mt-1">{String(detailItem.internal_notes)}</p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpenDetail(false)} className="flex-1 h-11 rounded-xl font-black">إغلاق</Button>
                <Link to="/expenses" className="flex-1"><Button className="w-full h-11 rounded-xl bg-slate-900 text-white font-black">الذهاب للمصروفات</Button></Link>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center font-bold text-muted">جاري التحميل...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label className="mr-1 text-[11px] font-black uppercase tracking-widest text-muted">{label}</label>{children}</div>;
}
