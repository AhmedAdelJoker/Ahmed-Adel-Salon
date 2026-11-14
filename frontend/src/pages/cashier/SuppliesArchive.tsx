import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
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
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { baseURL } from "@/services/api";
import exportService from "@/services/exportService";
import { cn, formatDate, formatNumber } from "@/lib/core/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
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
import { LogDetailDialog, type InventoryLog } from "@/features/inventory-archive";

const PAGE_SIZE = 25;

type LogSummary = { total: number; adds: number; removes: number; net: number };
const EMPTY_SUMMARY: LogSummary = { total: 0, adds: 0, removes: 0, net: 0 };

function typeMeta(type: string, t: (k: string) => string) {
  if (type === "add") return { label: t("inventoryArchive.add"), variant: "success" as const, icon: Plus, cls: "bg-success/10 text-success" };
  if (type === "remove") return { label: t("inventoryArchive.remove"), variant: "danger" as const, icon: Minus, cls: "bg-danger/10 text-danger" };
  return { label: t("inventoryArchive.adjust"), variant: "info" as const, icon: Settings, cls: "bg-info/10 text-info" };
}

export default function SuppliesArchive() {
  const { t } = useTranslation("owner");
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<LogSummary>(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<InventoryLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const staticBaseUrl = baseURL.replace("/api/v1", "");

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterType, fromDate, toDate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/products/logs/all", {
        params: {
          page,
          page_size: PAGE_SIZE,
          type: filterType !== "all" ? filterType : undefined,
          q: debouncedSearch || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      const data = res.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setLogs(items);
      setSummary(data.summary || EMPTY_SUMMARY);
      const headers = res.headers || {};
      const count = Number(headers["x-total-count"] ?? items.length);
      const pages = Number(headers["x-total-pages"] ?? Math.max(1, Math.ceil(count / PAGE_SIZE)));
      setTotal(Number.isFinite(count) ? count : items.length);
      setTotalPages(Number.isFinite(pages) && pages > 0 ? pages : 1);
    } catch (err: any) {
      if (err?.response?.status === 403) toast.error(t("inventoryArchive.noAccessMessage"));
      else toast.error(t("inventoryArchive.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, filterType, debouncedSearch, fromDate, toDate, t]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const productFor = useCallback((log: InventoryLog) => ({
    id: log.product_id,
    name: log.product_name || t("inventoryArchive.unknownProduct", { id: log.product_id }),
    category: log.product_category || undefined,
    unit: log.product_unit || undefined,
  }), [t]);

  const creatorName = useCallback((log: InventoryLog) => {
    if (log.created_by_name && String(log.created_by_name).trim()) return String(log.created_by_name);
    if (log.created_by_user_id != null) return t("inventoryArchive.creatorUser", { id: log.created_by_user_id });
    return t("inventoryArchive.creatorSystem");
  }, [t]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await exportService.downloadCsv("/exports/inventory-logs/csv", "inventory_logs", {
        type: filterType !== "all" ? filterType : undefined,
        q: debouncedSearch || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setFilterType("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const links = [
    { label: t("inventoryArchive.goInventory"), desc: t("inventoryArchive.goInventoryDesc"), href: "/inventory", icon: Package },
    { label: t("inventoryArchive.goBundles"), desc: t("inventoryArchive.goBundlesDesc"), href: "/inventory/bundles", icon: History },
    { label: t("inventoryArchive.goExpenses"), desc: t("inventoryArchive.goExpensesDesc"), href: "/expenses", icon: ArrowLeftRight },
    { label: t("inventoryArchive.goInvoices"), desc: t("inventoryArchive.goInvoicesDesc"), href: "/invoices", icon: Calendar },
  ];

  const hasFilters = !!(searchTerm || filterType !== "all" || fromDate || toDate);

  return (
    <div className="min-h-screen app-shell-bg p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("inventoryArchive.title")}
        subtitle={t("inventoryArchive.subtitle")}
        badge={t("inventoryArchive.badge")}
        icon={History}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => void fetchLogs()}><RefreshCw size={14} className="me-1.5" />{t("inventoryArchive.refresh")}</Button>
            <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => window.print()}><Printer size={14} className="me-1.5" />{t("inventoryArchive.print")}</Button>
            <Button variant="primary" size="sm" className="h-10 rounded-xl" onClick={() => void exportCsv()} disabled={exporting}><Download size={14} className="me-1.5" />{t("inventoryArchive.exportCsv")}</Button>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("inventoryArchive.summaryTotal"), value: summary.total, cls: "text-main" },
          { label: t("inventoryArchive.summaryAdds"), value: summary.adds, cls: "text-success" },
          { label: t("inventoryArchive.summaryRemoves"), value: summary.removes, cls: "text-danger" },
          { label: t("inventoryArchive.summaryNet"), value: summary.net, cls: summary.net >= 0 ? "text-success" : "text-danger" },
        ].map((c) => (
          <PremiumCard key={c.label} className="p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">{c.label}</p>
            <p className={cn("mt-1 text-2xl font-black tabular-nums", c.cls)}>{formatNumber(c.value)}</p>
          </PremiumCard>
        ))}
      </div>

      <PremiumCard className="mt-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t("inventoryArchive.searchPlaceholder")} className="h-10 rounded-xl ps-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t("inventoryArchive.type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inventoryArchive.allTypes")}</SelectItem>
              <SelectItem value="add">{t("inventoryArchive.add")}</SelectItem>
              <SelectItem value="remove">{t("inventoryArchive.remove")}</SelectItem>
              <SelectItem value="adjust">{t("inventoryArchive.adjust")}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-xl" aria-label={t("inventoryArchive.fromDate")} />
          <div className="flex gap-2">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-xl" aria-label={t("inventoryArchive.toDate")} />
            {hasFilters && <Button variant="ghost" size="sm" className="h-10 shrink-0 rounded-xl px-3" onClick={clearFilters} title={t("inventoryArchive.clearFilters")}><RotateCcw size={14} /></Button>}
          </div>
        </div>
      </PremiumCard>

      <div className="mt-3 flex items-center justify-between text-xs font-bold text-muted">
        <span>{t("inventoryArchive.resultsCount", { count: total })}</span>
        {totalPages > 1 && <span>{t("inventoryArchive.showingPage", { page, pages: totalPages })}</span>}
      </div>

      <PremiumCard className="mt-3 overflow-hidden p-0">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm font-bold text-muted"><History className="animate-pulse" size={18} /> {t("inventoryArchive.loading")}</div>
        ) : logs.length === 0 ? (
          <div className="p-6"><EmptyState title={t("inventoryArchive.emptyTitle")} message={t("inventoryArchive.emptyMessage")} icon={AlertTriangle} /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-soft/40">
                  <TableHead className="text-start font-black">{t("inventoryArchive.colMovement")}</TableHead>
                  <TableHead className="text-start font-black">{t("inventoryArchive.colProduct")}</TableHead>
                  <TableHead className="text-start font-black">{t("inventoryArchive.colChange")}</TableHead>
                  <TableHead className="text-start font-black">{t("inventoryArchive.colBalance")}</TableHead>
                  <TableHead className="text-start font-black">{t("inventoryArchive.colUser")}</TableHead>
                  <TableHead className="text-start font-black">{t("inventoryArchive.colDate")}</TableHead>
                  <TableHead className="text-start font-black">{t("inventoryArchive.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const meta = typeMeta(log.type, t);
                  const Icon = meta.icon;
                  return (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-soft/30" onClick={() => { setSelectedLog(log); setIsDetailOpen(true); }}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", meta.cls)}><Icon size={14} /></span>
                          <div>
                            <div className="text-xs font-black text-main">{t("inventoryArchive.movementNo", { id: log.id })}</div>
                            <Badge variant={meta.variant} className="mt-0.5 rounded-md px-1.5 py-0 text-[9px] font-bold">{meta.label}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px]">
                          <div className="truncate text-sm font-bold text-main">{log.product_name || t("inventoryArchive.unknownProduct", { id: log.product_id })}</div>
                          <div className="truncate text-[10px] font-medium text-muted">{log.product_category || t("inventoryArchive.unknownCategory")}{log.note ? ` • ${log.note}` : ""}</div>
                        </div>
                      </TableCell>
                      <TableCell className={cn("font-black tabular-nums", Number(log.change_amount) > 0 ? "text-success" : Number(log.change_amount) < 0 ? "text-danger" : "text-main")}>
                        {Number(log.change_amount) > 0 ? "+" : ""}{formatNumber(log.change_amount)} {log.product_unit || ""}
                      </TableCell>
                      <TableCell className="text-xs font-bold tabular-nums text-muted">
                        {log.stock_before != null && log.stock_after != null ? `${formatNumber(log.stock_before)} → ${formatNumber(log.stock_after)}` : t("inventoryArchive.balanceUnknown")}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-main">{creatorName(log)}</TableCell>
                      <TableCell className="text-xs font-medium tabular-nums text-muted">{log.created_at ? formatDate(log.created_at) : "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-[11px]" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setIsDetailOpen(true); }}>{t("inventoryArchive.details")}</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PremiumCard>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronRight size={15} /></Button>
          <span className="px-2 text-sm font-bold text-muted">{t("inventoryArchive.showingPage", { page, pages: totalPages })}</span>
          <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronLeft size={15} /></Button>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-xs font-black uppercase tracking-wider text-muted">{t("inventoryArchive.systemTitle")}</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {links.map((l) => (
            <button key={l.href} type="button" onClick={() => navigate(l.href)} className="rounded-xl border border-border bg-card p-3 text-start transition hover:border-primary/20 hover:shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-main"><l.icon size={14} className="text-primary" />{l.label}</div>
              <div className="mt-1 text-[10px] font-medium text-muted">{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <LogDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        log={selectedLog}
        product={selectedLog ? productFor(selectedLog) : undefined}
        staticBaseUrl={staticBaseUrl}
        onGoInventory={() => navigate("/inventory")}
      />
    </div>
  );
}
