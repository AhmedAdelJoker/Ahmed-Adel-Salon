import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import payrollService from "@/services/payrollService";
import { adaptApiResponse } from "@/services/apiAdapter";
import toast from "react-hot-toast";
import exportService from "@/services/exportService";
import { useAuth } from "@/context/AuthContext";
import {
  Archive,
  ArrowRight,
  Banknote,
  Calendar,
  FileSpreadsheet,
  Filter,
  Printer,
  Search,
  X,
  TrendingUp,
  Users,
  Wallet,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { formatCurrency } from "@/lib/core/utils";

const MONTHS = [
  { value: "all", label: "كل الشهور" },
  { value: 1, label: "يناير" },
  { value: 2, label: "فبراير" },
  { value: 3, label: "مارس" },
  { value: 4, label: "أبريل" },
  { value: 5, label: "مايو" },
  { value: 6, label: "يونيو" },
  { value: 7, label: "يوليو" },
  { value: 8, label: "أغسطس" },
  { value: 9, label: "سبتمبر" },
  { value: 10, label: "أكتوبر" },
  { value: 11, label: "نوفمبر" },
  { value: 12, label: "ديسمبر" },
];

const YEARS = [2024, 2025, 2026, 2027];
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

function buildCleanParams(filters: {
  start_year: number | string;
  end_year: number | string;
  period_month: number | string;
  status: string;
  q: string;
  page: number;
  limit: number;
}) {
  const skip = (Math.max(1, filters.page) - 1) * filters.limit;
  const out: Record<string, unknown> = {
    skip,
    limit: filters.limit,
  };
  if (filters.start_year !== "all" && filters.start_year !== "" && filters.start_year !== null) out.start_year = Number(filters.start_year);
  if (filters.end_year !== "all" && filters.end_year !== "" && filters.end_year !== null) out.end_year = Number(filters.end_year);
  if (filters.period_month !== "all" && filters.period_month !== "" && filters.period_month !== null) {
    const m = Number(filters.period_month);
    out.start_month = m;
    out.end_month = m;
  }
  if (filters.status && filters.status !== "all") out.status = filters.status;
  if (filters.q && String(filters.q).trim()) out.q = String(filters.q).trim();
  return out;
}

type ArchiveFilters = {
  start_year: number | string;
  end_year: number | string;
  period_month: number | string;
  status: string;
  q: string;
  page: number;
  limit: number;
};

const PayrollArchive = () => {
  const { user } = useAuth();
  const isOwner = useMemo(() => ["OWNER", "ADMIN"].includes(String(user?.role || "").toUpperCase()), [user?.role]);
  const [items, setItems] = useState<unknown[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<ArchiveFilters>({
    start_year: new Date().getFullYear(),
    end_year: "all",
    period_month: "all",
    status: "all",
    q: "",
    page: 1,
    limit: 20,
  });
  const [qDraft, setQDraft] = useState("");

  // debounce search draft -> filters.q
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((prev) => (prev.q === qDraft.trim() ? prev : { ...prev, q: qDraft, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [qDraft]);

  const fetchArchive = useCallback(async (activeFilters: ArchiveFilters) => {
    try {
      setLoading(true);
      const res = await payrollService.archive(buildCleanParams(activeFilters));
      const adapted = adaptApiResponse(res as unknown as Record<string, unknown>);
      setItems((adapted.items as unknown[]) || []);
      setTotal(Number((adapted as unknown as { total?: number }).total ?? (adapted.items as unknown[])?.length ?? 0));
    } catch {
      toast.error("فشل تحميل أرشيف الرواتب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchive(filters);
  }, [fetchArchive, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / filters.limit)), [total, filters.limit]);

  const kpis = useMemo(() => {
    const rows = items as Array<Record<string, unknown>>;
    const sum = rows.reduce((s, r) => s + Number((r as Record<string, unknown>).net_salary || 0), 0);
    const paid = rows.filter((r) => String((r as Record<string, unknown>).status) === "paid").length;
    const avg = rows.length ? sum / rows.length : 0;
    return { sum, count: rows.length, total, paid, avg };
  }, [items, total]);

  const handleReset = () => {
    setQDraft("");
    setFilters({
      start_year: "all",
      end_year: "all",
      period_month: "all",
      status: "all",
      q: "",
      page: 1,
      limit: 20,
    });
  };

  const handlePrint = () => window.print();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await payrollService.remove(deleteId);
      toast.success("تم حذف السجل من الأرشيف — بقي المصروف المالي محفوظاً");
      setDeleteId(null);
      fetchArchive(filters);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (msg && String(msg).includes("Cannot delete paid")) toast.error("لا يمكن حذف راتب مدفوع — استخدم الإلغاء بدلاً منه");
      else toast.error("فشل حذف السجل");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="erp-page-container space-y-6 pb-10">
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="حذف السجل من الأرشيف؟"
        description="سيتم حذف سجل الراتب من الأرشيف فقط — لن يتم حذف المصروف المالي المرتبط وسيبقى في سجلات الخزنة والمصروفات."
        onConfirm={handleDelete}
        loading={deleting}
      />
      <PageHeader
        title="أرشيف الرواتب"
        subtitle="السجل التاريخي لمدفوعات الموظفين — بحث زمني شامل مع تصدير"
        badge="الأرشيف المالي"
        icon={Archive}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="outline"
              onClick={() => exportService.downloadExcel("/exports/payroll/archive/excel", "payroll_archive", buildCleanParams(filters) as Record<string, unknown>)}
              className="h-11 rounded-xl px-4 font-black text-xs"
            >
              <FileSpreadsheet size={16} className="ml-1.5" /> Excel
            </Button>
            <Button variant="outline" onClick={handlePrint} className="h-11 rounded-xl px-4 font-black text-xs">
              <Printer size={16} className="ml-1.5" /> طباعة / PDF
            </Button>
            <Link to="/owner/payroll">
              <Button variant="ghost" className="h-11 rounded-xl border border-border bg-card px-4 font-black text-xs">
                <ArrowRight size={16} className="ml-1.5" /> العودة للرواتب
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PremiumCard className="p-5 flex flex-col gap-2" animate={false}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2"><Wallet size={12} className="text-primary" /> إجمالي المبالغ (النتائج الحالية)</div>
          <div className="text-2xl font-black tabular-nums text-main">{formatCurrency(kpis.sum)}</div>
          <div className="text-[11px] font-bold text-muted">{kpis.count} سجل في الصفحة • {kpis.total} إجمالي الأرشيف</div>
        </PremiumCard>
        <PremiumCard className="p-5 flex flex-col gap-2" animate={false}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2"><Users size={12} className="text-sky-600" /> متوسط الراتب</div>
          <div className="text-2xl font-black tabular-nums">{formatCurrency(kpis.avg)}</div>
          <div className="text-[11px] font-bold text-muted">للصفحة الحالية</div>
        </PremiumCard>
        <PremiumCard className="p-5 flex flex-col gap-2" animate={false}>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2"><TrendingUp size={12} className="text-emerald-600" /> المدفوع في النتائج</div>
          <div className="text-2xl font-black tabular-nums text-emerald-600">{kpis.paid} سجل</div>
          <div className="text-[11px] font-bold text-muted">من {kpis.count} في الصفحة</div>
        </PremiumCard>
      </div>

      {/* Filters */}
      <PremiumCard noPadding className="overflow-hidden" animate={false}>
        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Filter size={14} /></div>
            <div>
              <h3 className="text-sm font-black">فلاتر البحث المتقدم</h3>
              <p className="text-[11px] font-bold text-muted">نطاق زمني + حالة + بحث بالاسم — كل تغيير يحدّث النتائج تلقائياً</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset} className="mr-auto h-8 rounded-xl text-xs font-black gap-1"><X size={12} /> إعادة ضبط</Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Field label="من سنة">
              <Select value={String(filters.start_year)} onValueChange={(v) => setFilters((p) => ({ ...p, start_year: v === "all" ? "all" : Number(v), page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="إلى سنة">
              <Select value={String(filters.end_year)} onValueChange={(v) => setFilters((p) => ({ ...p, end_year: v === "all" ? "all" : Number(v), page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="الشهر">
              <Select value={String(filters.period_month)} onValueChange={(v) => setFilters((p) => ({ ...p, period_month: v === "all" ? "all" : Number(v), page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={String(m.value)} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="الحالة">
              <Select value={filters.status} onValueChange={(v) => setFilters((p) => ({ ...p, status: v, page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="calculated">محسوب (غير مدفوع)</SelectItem>
                  <SelectItem value="audited">مدقق</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="عدد الصفوف">
              <Select value={String(filters.limit)} onValueChange={(v) => setFilters((p) => ({ ...p, limit: Number(v), page: 1 }))}>
                <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n} / صفحة</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="بحث بالاسم">
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={qDraft} onChange={(e) => setQDraft(e.target.value)} placeholder="اكتب اسم الموظف... يبحث تلقائياً" className="h-11 pr-9 rounded-xl bg-soft border-border font-bold" />
              {qDraft && (
                <button onClick={() => setQDraft("")} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-card border flex items-center justify-center text-muted">
                  <X size={12} />
                </button>
              )}
            </div>
          </Field>

          <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
            <span className="hidden sm:inline">النتائج تحدّث تلقائياً • </span>
            <span>{total} سجل إجمالي • صفحة {filters.page} من {totalPages}</span>
          </div>
        </div>
      </PremiumCard>

      {/* Table / Cards */}
      <Card className="overflow-hidden rounded-[24px] border-border bg-card p-0 shadow-soft">
        {loading ? (
          <div className="p-6 space-y-3">
            <SkeletonCard variant="stats" />
            <SkeletonCard variant="stats" />
            <SkeletonCard variant="stats" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right">
                <thead className="sticky top-0 z-10 bg-soft/70 backdrop-blur border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الموظف</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الفترة</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الصافي</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الطريقة</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">تاريخ الصرف</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">الحالة</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted print:hidden">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(items as Array<Record<string, unknown>>).map((item) => (
                    <tr key={String(item.id)} className="hover:bg-soft/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-soft border flex items-center justify-center font-black text-accent text-xs shrink-0">{(String(item.employee_name_snapshot || "U"))[0]}</div>
                          <div className="min-w-0"><div className="text-sm font-black truncate">{String(item.employee_name_snapshot || "غير محدد")}</div><div className="text-[10px] font-bold text-muted truncate">{String(item.role_snapshot || "—")}</div></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-black tabular-nums">{MONTHS.find((m) => m.value === item.period_month)?.label || String(item.period_month)} {String(item.period_year)}</td>
                      <td className="px-6 py-4 text-sm font-black tabular-nums">{formatCurrency(item.net_salary)}</td>
                      <td className="px-6 py-4 text-xs font-bold">{paymentLabel(item.payment_method)}</td>
                      <td className="px-6 py-4 text-xs font-bold text-muted">{item.payment_date ? new Date(String(item.payment_date)).toLocaleDateString("ar-EG") : "—"}</td>
                      <td className="px-6 py-4"><StatusBadge status={String(item.status || "")} /></td>
                      <td className="px-6 py-4 text-center print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => { setDetailItem(item); setDetailOpen(true); }} className="h-8 rounded-xl text-[11px] font-black">تفاصيل</Button>
                          <Button variant="ghost" size="sm" onClick={() => exportService.downloadPdf(`/exports/payroll/${String(item.id)}/pdf`, `payslip_${String(item.employee_name_snapshot)}_${String(item.period_month)}_${String(item.period_year)}`)} className="h-8 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-[11px] font-black">PDF</Button>
                          {isOwner && (
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(String(item.id))} disabled={String(item.status) === "paid"} title={String(item.status) === "paid" ? "لا يمكن حذف راتب مدفوع" : "حذف من الأرشيف فقط — يبقى المصروف"} className="h-8 w-8 p-0 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white disabled:opacity-40">
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="py-20 text-center"><Archive size={40} className="mx-auto text-muted/20 mb-3" /><p className="text-sm font-black text-muted">لا توجد نتائج مطابقة</p><p className="text-[11px] font-bold text-muted/70">جرّب توسيع الفترة أو مسح البحث</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden p-4 grid grid-cols-1 gap-3">
              {(items as Array<Record<string, unknown>>).map((item) => (
                <PremiumCard key={String(item.id)} className="p-4 space-y-3" animate={false} hoverable={false}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-soft border flex items-center justify-center font-black text-accent">{(String(item.employee_name_snapshot || "U"))[0]}</div><div><div className="text-sm font-black">{String(item.employee_name_snapshot || "—")}</div><div className="text-[10px] font-bold text-muted">{String(item.role_snapshot || "—")} • {MONTHS.find((m) => m.value === item.period_month)?.label} {String(item.period_year)}</div></div></div>
                    <StatusBadge status={String(item.status || "")} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-soft p-3 border"><div className="text-[9px] font-black text-muted uppercase">الصافي</div><div className="font-black tabular-nums">{formatCurrency(item.net_salary)}</div></div>
                    <div className="rounded-xl bg-soft p-3 border"><div className="text-[9px] font-black text-muted uppercase">الطريقة</div><div className="font-black">{paymentLabel(item.payment_method)}</div></div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setDetailItem(item); setDetailOpen(true); }} className="flex-1 h-9 rounded-xl text-xs font-black">تفاصيل</Button>
                    <Button variant="ghost" onClick={() => exportService.downloadPdf(`/exports/payroll/${String(item.id)}/pdf`, `payslip_${String(item.employee_name_snapshot)}`)} className="flex-1 h-9 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-xs font-black">PDF</Button>
                    {isOwner && (
                      <Button variant="ghost" onClick={() => setDeleteId(String(item.id))} disabled={String(item.status) === "paid"} className="h-9 w-9 p-0 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 disabled:opacity-40 shrink-0">
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </PremiumCard>
              ))}
              {items.length === 0 && <div className="py-10 text-center font-bold text-muted">لا توجد نتائج</div>}
            </div>

            {/* Pagination — Phase 2: unified <Pagination /> */}
            {total > 0 && (() => {
              const paginator = createPaginationState({
                page: filters.page,
                size: filters.limit,
                total,
              });
              return (
                <div className="border-t border-border bg-soft/20 px-2 py-3 print:hidden">
                  <Pagination
                    paginator={paginator}
                    onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
                    onSizeChange={(s) => setFilters((prev) => ({ ...prev, limit: s, page: 1 }))}
                    locale="ar"
                  />
                  <div className="flex items-center justify-center gap-2 px-3 pb-1 text-[10px] font-bold text-muted">
                    <span>صفحة {filters.page} من {totalPages}</span>
                    <span className="hidden sm:inline">•</span>
                    <span>{total} سجل</span>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg rounded-[24px] border-0 p-0 overflow-hidden bg-card shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative overflow-hidden">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
            <div className="relative flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10"><Banknote size={20} /></div>
              <div>
                <DialogTitle className="text-lg font-black text-white">قسيمة الراتب</DialogTitle>
                <DialogDescription className="text-xs font-bold text-slate-300">قراءة فقط • الأرشيف لا يسمح بالتعديل</DialogDescription>
              </div>
              <div className="mr-auto"><StatusBadge status={String(detailItem?.status || "")} /></div>
            </div>
            {detailItem && (
              <div className="relative mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <Calendar size={12} /> {String(detailItem.employee_name_snapshot || "—")} • {MONTHS.find((m) => m.value === detailItem.period_month)?.label} {String(detailItem.period_year)}
              </div>
            )}
          </div>
          {detailItem ? (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-soft border p-4"><div className="text-[9px] font-black text-muted uppercase">الأساسي</div><div className="font-black tabular-nums">{formatCurrency(detailItem.base_salary)}</div></div>
                <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4"><div className="text-[9px] font-black text-muted uppercase">العمولة</div><div className="font-black text-sky-700 tabular-nums">{formatCurrency(detailItem.commission_amount)}</div></div>
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><div className="text-[9px] font-black text-muted uppercase">مكافآت</div><div className="font-black text-emerald-700 tabular-nums">{formatCurrency(detailItem.bonus_amount)}</div></div>
                <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4"><div className="text-[9px] font-black text-muted uppercase">خصومات + سلف</div><div className="font-black text-rose-700 tabular-nums">{formatCurrency(Number(detailItem.deduction_amount || 0) + Number(detailItem.advance_amount || 0))}</div></div>
              </div>
              <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                <span className="text-[11px] font-black text-white/60 uppercase">الصافي</span><span className="text-xl font-black tabular-nums">{formatCurrency(detailItem.net_salary)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-soft border p-3"><div className="text-[9px] font-black text-muted uppercase">الطريقة</div><div className="font-black text-sm">{paymentLabel(detailItem.payment_method)}</div></div>
                <div className="rounded-xl bg-soft border p-3"><div className="text-[9px] font-black text-muted uppercase">تاريخ الصرف</div><div className="font-black text-sm">{detailItem.payment_date ? new Date(String(detailItem.payment_date)).toLocaleDateString("ar-EG") : "—"}</div></div>
              </div>
              {detailItem.notes != null && String(detailItem.notes).trim() ? <div className="rounded-xl border bg-card p-3"><div className="text-[10px] font-black text-muted uppercase">ملاحظات</div><p className="text-sm font-bold leading-relaxed whitespace-pre-wrap">{String((detailItem as any).notes)}</p></div> : null}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="flex-1 h-11 rounded-xl font-black">إغلاق</Button>
                <Button onClick={() => exportService.downloadPdf(`/exports/payroll/${String(detailItem.id)}/pdf`, `payslip_${String(detailItem.employee_name_snapshot)}_${String(detailItem.period_month)}_${String(detailItem.period_year)}`)} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-black">تحميل PDF</Button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center font-bold text-muted">جاري التحميل...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><label className="mr-1 text-[11px] font-black uppercase tracking-widest text-muted">{label}</label>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "مدفوع", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    cancelled: { label: "ملغي", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    calculated: { label: "محسوب", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    audited: { label: "مدقق", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  };
  const cur = map[status] || { label: status || "مسودة", cls: "bg-soft text-muted border-border" };
  return <Badge className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${cur.cls}`}>{cur.label}</Badge>;
}

export default PayrollArchive;
