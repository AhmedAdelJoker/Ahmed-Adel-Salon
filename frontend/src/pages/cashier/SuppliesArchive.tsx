import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Minus,
  Package,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Eye,
  Scale,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import api, { baseURL } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { cn, formatDate, formatNumber } from "@/lib/core/utils";
import EmptyState from "@/components/shared/EmptyState";
import {
  PageHeader,
  PremiumCard,
  SkeletonCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInventoryLogs } from "@/hooks/useApi";
import {
  LOG_TYPE_OPTIONS,
  LogDetailDialog,
  buildInventoryLogsCsv,
  downloadCsv,
  formatTimeOnly,
  getLogTypeMeta,
  resolveCreatorName,
  resolveLogProduct,
  type InventoryLog,
  type ProductMap,
} from "@/features/inventory-archive";

const PAGE_SIZE = 25;

export default function SuppliesArchive() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const [selectedLog, setSelectedLog] = useState<InventoryLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [productMap, setProductMap] = useState<ProductMap>({});

  const staticBaseUrl = useMemo(() => baseURL.replace("/api/v1", ""), []);

  // Debounce search to avoid a request per keystroke (server-side search)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data, isLoading, isFetching, error, refetch } = useInventoryLogs({
    ...(filterType !== "all" ? { type: filterType } : {}),
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(fromDate ? { from_date: fromDate } : {}),
    ...(toDate ? { to_date: toDate } : {}),
    page,
    page_size: PAGE_SIZE,
  });

  const rows: InventoryLog[] = data?.items || [];
  const totalCount: number = Number(data?.total ?? 0);
  const summary = data?.summary;
  const totalPages = data ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 1;

  const fetchProductsMap = useCallback(async () => {
    try {
      const res = await api.get("/products", { params: { limit: 1000 } });
      const items = res.data || [];
      const map: ProductMap = {};
      (Array.isArray(items) ? items : []).forEach((p) => {
        map[p.id] = p;
      });
      setProductMap(map);
    } catch (_err) {
      // silent — product names fall back to server-enriched fields, images to placeholder
    }
  }, []);

  useEffect(() => {
    fetchProductsMap();
  }, [fetchProductsMap]);

  const openDetail = (log: InventoryLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const loadFailed = Boolean(error) && rows.length === 0 && !isLoading;

  // Export covers the WHOLE filtered scope (not just the visible page):
  // pages through the same server filters, capped to protect the browser.
  const EXPORT_PAGE_SIZE = 200;
  const EXPORT_MAX_PAGES = 10; // 2000 rows max

  const baseExportParams = {
    ...(filterType !== "all" ? { type: filterType } : {}),
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(fromDate ? { from_date: fromDate } : {}),
    ...(toDate ? { to_date: toDate } : {}),
  };

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const first = await api.get("/products/logs/all", {
        params: { ...baseExportParams, page: 1, page_size: EXPORT_PAGE_SIZE },
      });
      const total = Number(first.data?.total ?? 0);
      const all: InventoryLog[] = Array.isArray(first.data?.items)
        ? [...first.data.items]
        : [];
      if (total === 0 || all.length === 0) {
        toast.error("لا توجد بيانات للتصدير في النطاق الحالي");
        return;
      }
      const pages = Math.min(
        Math.ceil(total / EXPORT_PAGE_SIZE),
        EXPORT_MAX_PAGES,
      );
      for (let p = 2; p <= pages; p += 1) {
        const res = await api.get("/products/logs/all", {
          params: { ...baseExportParams, page: p, page_size: EXPORT_PAGE_SIZE },
        });
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        all.push(...items);
        if (items.length < EXPORT_PAGE_SIZE) break;
      }
      const csv = buildInventoryLogsCsv(all, productMap);
      downloadCsv(
        `inventory_logs_${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
      );
      if (total > all.length) {
        toast.success(
          `تم تصدير ${formatNumber(all.length)} من ${formatNumber(total)} (الحد الأقصى ${formatNumber(EXPORT_PAGE_SIZE * EXPORT_MAX_PAGES)})`,
        );
      } else {
        toast.success(`تم تصدير ${formatNumber(all.length)} حركة بنجاح`);
      }
    } catch (_err) {
      toast.error("فشل التصدير — تحقق من الاتصال ثم أعد المحاولة");
    } finally {
      setExporting(false);
    }
  }, [exporting, filterType, debouncedSearch, fromDate, toDate, productMap]);

  const handleReset = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearch("");
    setFilterType("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }, []);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    filterType !== "all" ||
    fromDate !== "" ||
    toDate !== "";

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (isLoading && !data) {
    return (
      <div className="erp-page space-y-6 pb-10">
        <PageHeader
          title="أرشيف المخزن"
          subtitle="سجل حركة المخزن والمنتجات المؤرشفة — قراءة فقط"
          badge="سجل المخزون"
          icon={History}
          className={undefined}
          actions={undefined}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
      </div>
    );
  }

  return (
    <div className="erp-page space-y-6 pb-10">
      <PageHeader
        title="أرشيف المخزن"
        subtitle="سجل حركة المخزن والمنتجات المؤرشفة — قراءة فقط"
        badge="سجل المخزون"
        icon={History}
        className={undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="outline"
              onClick={() => navigate("/inventory")}
              className="h-11 rounded-xl px-4 font-black border-border bg-card"
            >
              <ChevronRight size={16} className="ml-1.5" /> المستودع
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              loading={exporting}
              disabled={exporting || totalCount === 0}
              title={`تصدير كامل النطاق المفلتر (${formatNumber(totalCount)} حركة)`}
              className="h-11 rounded-xl px-4 font-black border-border bg-card"
            >
              <Download size={16} className="ml-1.5" /> تصدير CSV
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              className="h-11 rounded-xl px-4 font-black border-border bg-card"
            >
              <Printer size={16} className="ml-1.5" /> طباعة / PDF
            </Button>
            <Button
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-11 rounded-xl px-5"
            >
              <RefreshCw
                size={16}
                className={isFetching ? "ml-1.5 animate-spin" : "ml-1.5"}
              />
              تحديث
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="إجمالي الحركات"
          value={formatNumber(summary?.total || 0)}
          icon={History}
          variant="primary"
          delay={0}
        />
        <StatCard
          label="عمليات توريد"
          value={formatNumber(summary?.adds || 0)}
          icon={Plus}
          variant="success"
          delay={0.05}
        />
        <StatCard
          label="عمليات صرف"
          value={formatNumber(summary?.removes || 0)}
          icon={Minus}
          variant="danger"
          delay={0.1}
        />
        <StatCard
          label="صافي الكمية"
          value={`${Number(summary?.net || 0) > 0 ? "+" : ""}${formatNumber(Number(summary?.net || 0))}`}
          icon={Scale}
          variant="info"
          delay={0.15}
        />
      </div>

      {/* Filters */}
      <PremiumCard className="p-4 sm:p-5 print:hidden">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={14} className="text-primary" />
          <span className="text-xs font-black text-muted uppercase tracking-widest">
            نطاق السجل والبحث
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="mr-auto h-8 gap-1 rounded-xl text-xs font-black"
            >
              <RotateCcw size={12} /> إعادة ضبط
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <label htmlFor="inv-archive-search" className="text-[10px] font-black text-muted uppercase">
              بحث في السجل
            </label>
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                id="inv-archive-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الصنف أو الملاحظة أو رقم الحركة..."
                aria-label="بحث في سجل المخزون"
                className="h-11 pr-10 rounded-xl bg-soft border-border font-bold"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inv-archive-type" className="text-[10px] font-black text-muted uppercase">
              نوع الحركة
            </label>
            <Select
              value={filterType}
              onValueChange={(v) => {
                setFilterType(v);
                setPage(1);
              }}
            >
              <SelectTrigger id="inv-archive-type" className="h-11 w-full rounded-xl bg-soft border-border font-bold">
                <SelectValue placeholder="نوع الحركة" />
              </SelectTrigger>
              <SelectContent>
                {LOG_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inv-archive-from" className="text-[10px] font-black text-muted uppercase">من تاريخ</label>
            <Input
              id="inv-archive-from"
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
            <label htmlFor="inv-archive-to" className="text-[10px] font-black text-muted uppercase">إلى تاريخ</label>
            <Input
              id="inv-archive-to"
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
          <div className="flex items-end">
            <Badge variant="primary" className="rounded-full h-11 px-5 text-xs font-black tabular-nums">
              {formatNumber(totalCount)} حركة في النطاق
            </Badge>
          </div>
        </div>
      </PremiumCard>

      {/* Logs Table */}
      <PremiumCard noPadding className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border bg-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-black flex items-center gap-2">
            <History size={16} className="text-primary" /> سجل الحركات التفصيلي
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="hidden sm:inline text-muted">يعرض</span>
            <Badge variant="primary" className="rounded-full tabular-nums">
              {formatNumber(rows.length)} من {formatNumber(totalCount)}
            </Badge>
            {isFetching && !isLoading && (
              <span className="text-muted flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> جاري التحديث...
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-muted">
            <RefreshCw className="h-5 w-5 animate-spin" /> جاري مراجعة الأرشيف...
          </div>
        ) : loadFailed ? (
          <div className="p-4 sm:p-6">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-10 text-center">
              <AlertTriangle size={26} className="text-danger" />
              <p className="text-sm font-black text-main">تعذر تحميل سجل المخزون</p>
              <p className="max-w-sm text-xs font-bold text-muted">
                تحقق من الاتصال بالخادم ثم أعد المحاولة.
              </p>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                variant="outline"
                size="sm"
                className="rounded-xl font-black"
              >
                <RefreshCw size={14} className="ml-1" /> إعادة المحاولة
              </Button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              title="الأرشيف فارغ"
              text="لم نجد أي عمليات مسجلة تطابق بحثك — جرب توسيع نطاق التاريخ أو مسح البحث."
              icon={History}
              action={
                <Button
                  onClick={() => navigate("/inventory")}
                  className="h-10 rounded-xl px-5 text-xs font-black"
                >
                  العودة للمستودع
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-soft/50 text-[10px] font-black uppercase tracking-widest text-muted">
                    <TableHead className="px-4 py-4 sm:px-5">النوع</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">
                      التفاصيل / الملاحظات
                    </TableHead>
                    <TableHead className="px-4 py-4 sm:px-5 text-center">
                      الكمية
                    </TableHead>
                    <TableHead className="px-4 py-4 sm:px-5 text-center">
                      الرصيد
                    </TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">التاريخ</TableHead>
                    <TableHead className="px-4 py-4 sm:px-5">
                      المنشئ
                    </TableHead>
                    <TableHead className="px-4 py-4 sm:px-5 print:hidden">عرض</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {rows.map((log) => {
                    const meta = getLogTypeMeta(log.type);
                    const product = resolveLogProduct(log, productMap);
                    return (
                      <TableRow
                        key={log.id}
                        className="hover:bg-soft/30 transition-colors"
                      >
                        <TableCell className="px-4 py-4 sm:px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                meta.iconBg,
                              )}
                            >
                              {log.type === "add" ? (
                                <Plus size={16} />
                              ) : log.type === "remove" ? (
                                <Minus size={16} />
                              ) : (
                                <Settings size={16} />
                              )}
                            </div>
                            <Badge
                              variant={meta.badgeVariant}
                              className="rounded-full"
                            >
                              {meta.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 sm:px-5">
                          <div className="text-sm font-black text-main truncate max-w-[280px]">
                            {log.note || "حركة مخزنية"}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted mt-1">
                            <Package size={12} />
                            <span className="truncate">{product.name}</span>
                            <span>•</span>
                            <span>#{log.id}</span>
                          </div>
                          <div className="text-[10px] font-bold text-muted/80 mt-0.5 truncate max-w-[280px]">
                            {product.category || "غير مصنف"}
                            {product.unit ? ` • ${product.unit}` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 sm:px-5 text-center">
                          <span
                            className={cn(
                              "text-base font-black tabular-nums",
                              log.change_amount > 0
                                ? "text-success"
                                : log.change_amount < 0
                                  ? "text-danger"
                                  : "text-muted",
                            )}
                          >
                            {log.change_amount > 0 ? "+" : ""}
                            {formatNumber(log.change_amount)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 sm:px-5 text-center">
                          {log.stock_before === null ||
                          log.stock_before === undefined ||
                          log.stock_after === null ||
                          log.stock_after === undefined ? (
                            <span className="text-xs font-bold text-muted">—</span>
                          ) : (
                            <span
                              className="text-xs font-black tabular-nums text-main whitespace-nowrap"
                              title={`من ${formatNumber(log.stock_before)} إلى ${formatNumber(log.stock_after)}`}
                            >
                              {formatNumber(log.stock_before)}
                              <span className="mx-1 text-muted">←</span>
                              {formatNumber(log.stock_after)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 sm:px-5">
                          <div className="text-xs font-bold tabular-nums text-main flex items-center gap-1.5">
                            <Calendar size={12} className="text-muted" />
                            {formatDate(log.created_at)}
                          </div>
                          <div className="text-[10px] font-bold tabular-nums text-muted mt-1">
                            {formatTimeOnly(log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 sm:px-5">
                          <span
                            className="block max-w-[140px] truncate text-xs font-bold text-main"
                            title={resolveCreatorName(log)}
                          >
                            {resolveCreatorName(log)}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-4 sm:px-5 print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetail(log)}
                            className="h-9 w-9 rounded-xl"
                            title="عرض التفاصيل (قراءة فقط)"
                            aria-label={`عرض تفاصيل الحركة رقم ${log.id}`}
                          >
                            <Eye size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
              <AnimatePresence>
                {rows.map((log, idx) => {
                  const meta = getLogTypeMeta(log.type);
                  const product = resolveLogProduct(log, productMap);
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                              meta.iconBg,
                            )}
                          >
                            {log.type === "add" ? (
                              <Plus size={16} />
                            ) : log.type === "remove" ? (
                              <Minus size={16} />
                            ) : (
                              <Settings size={16} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black truncate">
                              {log.note || "حركة مخزنية"}
                            </div>
                            <div className="text-[11px] font-bold text-muted truncate">
                              {product.name} • #{log.id}
                            </div>
                            <div className="text-[10px] font-bold text-muted/80 truncate">
                              {product.category || "غير مصنف"}
                              {product.unit ? ` • ${product.unit}` : ""}
                              {" • "}
                              {resolveCreatorName(log)}
                            </div>
                          </div>
                        </div>
                        <Badge variant={meta.badgeVariant} className="rounded-full shrink-0">
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between rounded-xl bg-soft border border-border p-3">
                          <span className="text-[11px] font-bold text-muted">
                            الكمية
                          </span>
                          <span
                            className={cn(
                              "text-sm font-black tabular-nums",
                              log.change_amount > 0
                                ? "text-success"
                                : log.change_amount < 0
                                  ? "text-danger"
                                  : "text-main",
                            )}
                          >
                            {log.change_amount > 0 ? "+" : ""}
                            {formatNumber(log.change_amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-soft border border-border p-3">
                          <span className="text-[11px] font-bold text-muted">
                            الرصيد
                          </span>
                          {log.stock_before === null ||
                          log.stock_before === undefined ||
                          log.stock_after === null ||
                          log.stock_after === undefined ? (
                            <span className="text-xs font-bold text-muted">—</span>
                          ) : (
                            <span className="text-xs font-black tabular-nums text-main whitespace-nowrap">
                              {formatNumber(log.stock_before)}
                              <span className="mx-1 text-muted">←</span>
                              {formatNumber(log.stock_after)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold tabular-nums text-muted">
                          {formatDate(log.created_at)} • {formatTimeOnly(log.created_at)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(log)}
                          className="rounded-xl font-black"
                        >
                          <Eye size={14} className="ml-1" /> التفاصيل
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between gap-2 print:hidden">
                <span className="text-sm font-bold tabular-nums text-muted">
                  صفحة {formatNumber(page)} من {formatNumber(totalPages)} — إجمالي {formatNumber(totalCount)} حركة
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                    aria-label="الصفحة السابقة"
                  >
                    <ChevronRight size={16} /> السابق
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isFetching}
                    aria-label="الصفحة التالية"
                  >
                    التالي <ChevronLeft size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PremiumCard>

      <LogDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        log={selectedLog}
        product={
          selectedLog ? resolveLogProduct(selectedLog, productMap) : undefined
        }
        staticBaseUrl={staticBaseUrl}
        onGoInventory={() => {
          setIsDetailOpen(false);
          navigate("/inventory");
        }}
      />
    </div>
  );
}
