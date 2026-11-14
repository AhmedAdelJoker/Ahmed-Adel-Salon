import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api, { baseURL } from "@/services/api";
import i18n from "@/i18n";
import { normalizeListResponse } from "@/services/apiAdapter";
import { exportService } from "@/services/exportService";
import { Droplets, Box } from "lucide-react";

export type InventoryProduct = Record<string, any>;

export interface InventoryStats {
  total: number;
  active: number;
  lowStock: number;
  cost: number;
  value: number;
  archived: number;
  uniqueCats: number;
}

export interface CategoryTone {
  Icon: typeof Droplets | typeof Box;
  badge: string;
  badgeKey?: string;
  iconClass: string;
}

/**
 * Inventory listing data: server-paginated products (scoped by tab/search/low-stock filter),
 * plus a global summary fetched from /products/summary so KPIs remain correct
 * across pages. `products` is the current page for the selected tab.
 */
export function useInventoryData(
  searchTerm: string,
  activeTab: "active" | "archived",
  lowStockOnly = false,
  sort = "",
  category = "",
) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<InventoryStats | null>(null);
  const [summaryReady, setSummaryReady] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const staticBaseUrl = baseURL.replace("/api/v1", "");

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get("/products/summary", {
        params: { q: searchTerm || undefined },
      });
      const d = res.data || {};
      setSummary({
        total: Number(d.total || 0),
        active: Number(d.active || 0),
        lowStock: Number(d.low_stock || 0),
        cost: Number(d.total_cost || 0),
        value: Number(d.total_value || 0),
        archived: Number(d.archived || 0),
        uniqueCats: Number(d.categories || 0),
      });
    } catch {
      setSummary(null);
    } finally {
      // The hero shows a shimmer skeleton rather than "0.00" while the first
      // summary request is in flight -- a zero that flashes and then jumps to
      // the real number reads as a bug, because it is one.
      setSummaryReady(true);
    }
  }, [searchTerm]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/products", {
        params: {
          q: searchTerm || undefined,
          is_archived: activeTab === "archived",
          low_stock: lowStockOnly || undefined,
          sort: sort || undefined,
          category: category || undefined,
          page,
          page_size: pageSize,
        },
      });
      const { items, total: totalCount } = normalizeListResponse(response);
      setProducts(items);
      setTotal(Number(totalCount ?? items.length));
    } catch {
      toast.error(
        i18n.t("owner:inventory.loadError", {
          defaultValue: "تعذر تحميل بيانات المخزون",
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [searchTerm, activeTab, page, pageSize, lowStockOnly, sort, category]);

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchData();
      void fetchSummary();
    }, 300);
    return () => clearTimeout(t);
  }, [fetchData, fetchSummary]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, activeTab, lowStockOnly, sort, category]);

  const stats: InventoryStats = useMemo(
    () =>
      summary ?? {
        total: 0,
        active: 0,
        lowStock: 0,
        cost: 0,
        value: 0,
        archived: 0,
        uniqueCats: 0,
      },
    [summary],
  );

  const uniqueCategories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [products]);

  const filteredProducts = products;

  const getCategoryTone = (category: string): CategoryTone => {
    const normalized = String(category || "").toLowerCase();
    if (
      normalized.includes("زيت") ||
      normalized.includes("serum") ||
      normalized.includes("سيروم") ||
      normalized.includes("oil")
    ) {
      return {
        Icon: Droplets,
        badgeKey: "inventory.categoryLiquids",
        badge: "سوائل وأمصال",
        iconClass: "bg-info/10 text-info",
      };
    }
    return {
      Icon: Box,
      badgeKey: "inventory.categoryEssentials",
      badge: "منتجات أساسية",
      iconClass: "bg-primary/10 text-primary",
    };
  };

  const handleExport = (_format?: string) => {
    void exportService.downloadExcel(
      "/exports/products/excel",
      `products_${new Date().toISOString().slice(0, 10)}`,
      {
        q: searchTerm || undefined,
        // The tab decides what is on screen, so it decides what is in the
        // file: exporting from the active tab used to hand over the archived
        // rows as well.
        is_archived: activeTab === "archived" ? "true" : "false",
      },
    );
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchSummary()]);
  }, [fetchData, fetchSummary]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    products,
    loading,
    stats,
    summaryReady,
    uniqueCategories,
    filteredProducts,
    getCategoryTone,
    handleExport,
    fetchData: refresh,
    fetchSummary,
    staticBaseUrl,
    page,
    setPage,
    pageSize,
    total,
    totalPages,
  };
}
