import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { activityLogService } from "@/services/activityLogService";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, PremiumCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { formatDateTime, formatNumber } from "@/lib/core/utils";

const PAGE_SIZE = 15;
const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_PAGES = 10;

const ACTION_OPTIONS = [
  { value: "all", label: "كل الإجراءات" },
  { value: "create", label: "إنشاء" },
  { value: "update", label: "تعديل" },
  { value: "delete", label: "حذف" },
  { value: "login", label: "دخول" },
  { value: "logout", label: "خروج" },
  { value: "cancel", label: "إلغاء" },
  { value: "refund", label: "استرداد" },
  { value: "discount", label: "خصم" },
  { value: "permission", label: "صلاحيات" },
] as const;

const ENTITY_OPTIONS = [
  { value: "all", label: "كل الكيانات" },
  { value: "user", label: "مستخدم" },
  { value: "employee", label: "موظف" },
  { value: "customer", label: "عميل" },
  { value: "product", label: "منتج" },
  { value: "service", label: "خدمة" },
  { value: "invoice", label: "فاتورة" },
  { value: "expense", label: "مصروف" },
  { value: "appointment", label: "موعد" },
] as const;

const ACTION_LABEL: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  login: "دخول",
  logout: "خروج",
  cancel: "إلغاء",
  refund: "استرداد",
  discount: "خصم",
  permission: "صلاحيات",
};

const ENTITY_LABEL: Record<string, string> = {
  user: "مستخدم",
  employee: "موظف",
  customer: "عميل",
  product: "منتج",
  service: "خدمة",
  invoice: "فاتورة",
  expense: "مصروف",
  appointment: "موعد",
};

function formatAction(value: unknown) {
  if (!value) return "غير محدد";
  const k = String(value).trim().toLowerCase();
  return ACTION_LABEL[k] || String(value).replace(/_/g, " ");
}

function formatEntity(value: unknown) {
  if (!value) return "عام";
  const k = String(value).trim().toLowerCase();
  return ENTITY_LABEL[k] || String(value).replace(/_/g, " ");
}

function csvEscape(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export default function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const buildParams = useCallback(
    (overrides: Record<string, unknown> = {}) => {
      const base: Record<string, unknown> = {
        page,
        page_size: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(actionFilter !== "all" ? { action: actionFilter } : {}),
        ...(entityFilter !== "all" ? { entity_type: entityFilter } : {}),
        ...(fromDate ? { start_date: fromDate } : {}),
        ...(toDate ? { end_date: toDate } : {}),
        ...overrides,
      };
      return base;
    },
    [page, debouncedSearch, actionFilter, entityFilter, fromDate, toDate],
  );

  const fetchLogs = useCallback(
    async ({ background = false }: { background?: boolean } = {}) => {
      try {
        if (background) setRefreshing(true);
        else setLoading(true);
        setLoadError(null);

        const response = await activityLogService.list(buildParams() as Record<string, unknown>);
        setLogs(response.items || []);
        setTotalCount(response.total || 0);
      } catch (error) {
        console.error("Activity logs load error:", error);
        setLoadError("تعذر تحميل سجل النشاط. تحقق من الاتصال ثم أعد المحاولة.");
        toast.error("تعذر تحميل سجل النشاط");
        setLogs([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildParams],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const hasActiveFilters =
    debouncedSearch !== "" || actionFilter !== "all" || entityFilter !== "all" || fromDate !== "" || toDate !== "";

  const handleReset = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearch("");
    setActionFilter("all");
    setEntityFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }, []);

  const handlePrint = useCallback(() => window.print(), []);

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const baseParams = {
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(actionFilter !== "all" ? { action: actionFilter } : {}),
        ...(entityFilter !== "all" ? { entity_type: entityFilter } : {}),
        ...(fromDate ? { start_date: fromDate } : {}),
        ...(toDate ? { end_date: toDate } : {}),
      };
      const first = await api.get("/activity-logs", {
        params: { ...baseParams, page: 1, page_size: EXPORT_PAGE_SIZE },
      });
      const payload = first.data as { items?: unknown[]; total?: number };
      const total = Number(payload?.total ?? 0);
      const all: any[] = Array.isArray(payload?.items) ? [...payload.items] : [];
      if (total === 0 || all.length === 0) {
        toast.error("لا توجد بيانات للتصدير في النطاق الحالي");
        return;
      }
      const pages = Math.min(Math.ceil(total / EXPORT_PAGE_SIZE), EXPORT_MAX_PAGES);
      for (let p = 2; p <= pages; p += 1) {
        const res = await api.get("/activity-logs", {
          params: { ...baseParams, page: p, page_size: EXPORT_PAGE_SIZE },
        });
        const d = res.data as { items?: unknown[] };
        const items = Array.isArray(d?.items) ? d.items : [];
        all.push(...(items as any[]));
        if (items.length < EXPORT_PAGE_SIZE) break;
      }
      const headers = ["المستخدم", "الإجراء", "الكيان", "الوصف", "التوقيت"];
      const rows = all.map((r: any) => [
        r.user_name || "مستخدم النظام",
        formatAction(r.action),
        formatEntity(r.entity_type),
        (r.description || "").replace(/\n/g, " "),
        r.created_at ? formatDateTime(r.created_at) : "",
      ]);
      const csv = ["\uFEFF" + headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (total > all.length) {
        toast.success(`تم تصدير ${formatNumber(all.length)} من ${formatNumber(total)} (الحد ${formatNumber(EXPORT_PAGE_SIZE * EXPORT_MAX_PAGES)})`);
      } else {
        toast.success(`تم تصدير ${formatNumber(all.length)} سجل بنجاح`);
      }
    } catch {
      toast.error("فشل التصدير — تحقق من الاتصال ثم أعد المحاولة");
    } finally {
      setExporting(false);
    }
  }, [exporting, debouncedSearch, actionFilter, entityFilter, fromDate, toDate]);

  if (loading && logs.length === 0 && !loadError) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <PageHeader title="سجل الرقابة" subtitle="مراجعة العمليات الحساسة والتغييرات المسجلة." badge="سجل النشاط" icon={ClipboardList} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-16">
      <PageHeader
        title="سجل الرقابة"
        subtitle="مراجعة العمليات الحساسة والتغييرات المالية والإدارية المسجلة داخل النظام."
        badge="سجل النشاط"
        icon={ClipboardList}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="outline"
              onClick={handleExport}
              loading={exporting}
              disabled={exporting || (totalCount === 0 && logs.length === 0)}
              title={`تصدير كامل النطاق المفلتر (${formatNumber(totalCount)} سجل)`}
              className="h-11 rounded-xl px-4 text-xs font-black"
            >
              <Download size={15} className="ml-1.5" /> تصدير CSV
            </Button>
            <Button variant="outline" onClick={handlePrint} className="h-11 rounded-xl px-4 text-xs font-black">
              <Printer size={15} className="ml-1.5" /> طباعة / PDF
            </Button>
            <Button onClick={() => fetchLogs({ background: true })} loading={refreshing} disabled={loading} className="h-11 rounded-xl px-5 text-xs font-black">
              <RefreshCw size={15} className="ml-1.5" /> تحديث
            </Button>
          </div>
        }
      />

      {/* Summary — from total, not page-local regex */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PremiumCard className="p-5" hoverable={false} animate={false}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-widest text-muted uppercase">إجمالي السجلات في النطاق</div>
              <div className="text-2xl font-black tabular-nums text-main mt-1">{formatNumber(totalCount)}</div>
              <div className="text-[11px] font-bold text-muted mt-1">يعكس الفلاتر الحالية</div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary shrink-0">
              <ClipboardList size={20} />
            </div>
          </div>
        </PremiumCard>
        <PremiumCard className="p-5" hoverable={false} animate={false}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-widest text-muted uppercase">نتائج الصفحة الحالية</div>
              <div className="text-2xl font-black tabular-nums text-main mt-1">{formatNumber(logs.length)}</div>
              <div className="text-[11px] font-bold text-muted mt-1">
                صفحة {formatNumber(page)} من {formatNumber(totalPages)}
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-soft border border-border flex items-center justify-center text-muted shrink-0">
              <Activity size={20} />
            </div>
          </div>
        </PremiumCard>
      </div>

      {/* Filters */}
      <PremiumCard className="p-4 sm:p-5 print:hidden" hoverable={false} animate={false}>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} className="text-primary" />
          <span className="text-[11px] font-black tracking-widest text-muted uppercase">فلاتر السجل</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="mr-auto h-8 gap-1 rounded-xl text-xs font-black">
              <RotateCcw size={12} /> إعادة ضبط
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <label htmlFor="activity-search" className="text-[10px] font-black tracking-widest text-muted uppercase">
              بحث
            </label>
            <div className="relative">
              <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                id="activity-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالإجراء، الكيان، أو الوصف..."
                aria-label="بحث في سجل النشاط"
                className="h-11 pr-10 rounded-xl bg-soft border-border font-bold"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-muted uppercase">الإجراء</label>
            <Select
              value={actionFilter}
              onValueChange={(v) => {
                setActionFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black tracking-widest text-muted uppercase">الكيان</label>
            <Select
              value={entityFilter}
              onValueChange={(v) => {
                setEntityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-11 rounded-xl bg-soft border-border font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="activity-from" className="text-[10px] font-black tracking-widest text-muted uppercase">
              من تاريخ
            </label>
            <Input
              id="activity-from"
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              aria-label="من تاريخ"
              className="h-11 rounded-xl bg-soft border-border font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="activity-to" className="text-[10px] font-black tracking-widest text-muted uppercase">
              إلى تاريخ
            </label>
            <Input
              id="activity-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              aria-label="إلى تاريخ"
              className="h-11 rounded-xl bg-soft border-border font-bold"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-muted">
          <span className="tabular-nums">
            {formatNumber(totalCount)} سجل في النطاق
          </span>
          {hasActiveFilters && <span className="h-1 w-1 rounded-full bg-border" />}
          {hasActiveFilters && <span>فلاتر نشطة</span>}
        </div>
      </PremiumCard>

      {loadError ? (
        <PremiumCard className="border-dashed" hoverable={false} animate={false}>
          <div className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="h-12 w-12 rounded-2xl bg-danger-soft border border-danger/10 flex items-center justify-center text-danger">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-sm font-black text-main">تعذر تحميل سجل النشاط</p>
              <p className="text-xs font-bold text-muted mt-1 max-w-md">{loadError}</p>
            </div>
            <Button onClick={() => fetchLogs()} loading={loading} className="h-11 rounded-xl px-6 text-xs font-black">
              <RefreshCw size={14} className="ml-1.5" /> إعادة المحاولة
            </Button>
          </div>
        </PremiumCard>
      ) : (
        <PremiumCard noPadding className="overflow-hidden" hoverable={false} animate={false}>
          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-soft/30">
                <TableRow className="hover:bg-transparent border-border/40 h-12">
                  <TableHead className="font-black text-muted px-5 text-right text-[10px] tracking-widest whitespace-nowrap">
                    المستخدم
                  </TableHead>
                  <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                    الإجراء
                  </TableHead>
                  <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                    الكيان
                  </TableHead>
                  <TableHead className="font-black text-muted text-right text-[10px] tracking-widest">الوصف</TableHead>
                  <TableHead className="font-black text-muted text-right text-[10px] tracking-widest whitespace-nowrap">
                    التوقيت
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id} className="border-border/40 hover:bg-soft/30">
                    <TableCell className="px-5 py-4 max-w-[180px]">
                      <span className="font-bold text-main text-sm truncate block" title={String(log.user_name || "مستخدم النظام")}>
                        {log.user_name || "مستخدم النظام"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className="rounded-full border-border bg-soft px-2.5 py-1 text-[11px] font-black">
                        {formatAction(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-soft border border-border px-2.5 py-1 text-[11px] font-bold text-muted">
                        {formatEntity(log.entity_type)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <span className="block truncate text-sm font-bold text-main" title={String(log.description || "لا يوجد وصف إضافي")}>
                        {log.description || "لا يوجد وصف إضافي"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs font-bold tabular-nums text-muted" title={log.created_at ? formatDateTime(log.created_at) : ""}>
                      {log.created_at ? formatDateTime(log.created_at) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <TableEmptyState
                        icon={ClipboardList}
                        title="لا توجد سجلات"
                        description={
                          hasActiveFilters
                            ? "لم يتم العثور على عمليات مطابقة للفلاتر الحالية — جرب توسيع الفترة أو مسح البحث."
                            : "لم يتم العثور على عمليات مطابقة للفلاتر الحالية."
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 p-4 lg:hidden">
            {logs.length === 0 ? (
              <TableEmptyState
                icon={ClipboardList}
                title="لا توجد سجلات"
                description={
                  hasActiveFilters
                    ? "لم يتم العثور على عمليات مطابقة للفلاتر الحالية — جرب توسيع الفترة أو مسح البحث."
                    : "لم يتم العثور على عمليات مطابقة للفلاتر الحالية."
                }
              />
            ) : (
              logs.map((log: any) => (
                <div key={log.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-main truncate" title={String(log.user_name || "مستخدم النظام")}>
                        {log.user_name || "مستخدم النظام"}
                      </div>
                      <div className="text-[11px] font-bold text-muted tabular-nums mt-0.5">
                        {log.created_at ? formatDateTime(log.created_at) : "—"}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 rounded-full text-[11px] font-black">
                      {formatAction(log.action)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-soft border px-2.5 py-1 text-[11px] font-bold text-muted">
                      {formatEntity(log.entity_type)}
                    </span>
                  </div>
                  <p className="text-sm font-bold leading-relaxed text-main line-clamp-3" title={String(log.description || "")}>
                    {log.description || "لا يوجد وصف إضافي"}
                  </p>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border bg-soft/30 p-4 print:hidden">
              <div className="text-xs font-bold tabular-nums text-muted">
                عرض {formatNumber(logs.length)} من أصل {formatNumber(totalCount)} سجل
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label="الصفحة السابقة"
                  onClick={() => setPage((prev: number) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  <ChevronRight size={16} />
                </Button>
                <span className="text-xs font-black tabular-nums text-main">
                  {formatNumber(page)} / {formatNumber(totalPages)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label="الصفحة التالية"
                  onClick={() => setPage((prev: number) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronLeft size={16} />
                </Button>
              </div>
            </div>
          )}
        </PremiumCard>
      )}
    </div>
  );
}
