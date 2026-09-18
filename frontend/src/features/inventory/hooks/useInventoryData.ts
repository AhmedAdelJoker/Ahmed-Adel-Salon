import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { getAvailablePacks, getEstimatedUnitCost } from "@/features/inventory";
import { exportService } from "@/services/exportService";
import { baseURL } from "@/services/api";
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
  iconClass: string;
}

/**
 * Inventory listing data: fetch (debounced search), tab filtering,
 * derived stats and category list. Extracted from pages/cashier/Inventory.
 *
 * Phase 2: backed by server-side pagination — only one page of products
 * is held in memory at a time. X-Total-Count is read from response headers.
 */
export const INVENTORY_PAGE_SIZE = 50;

export function useInventoryData() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const [page, setPage] = useState(1);
  const [size] = useState(INVENTORY_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  const STATIC_BASE_URL = useMemo(
    () => baseURL.replace("/api/v1", ""),
    [],
  );

  // Phase 2: paginator instance for <Pagination />
  const paginator = useMemo(
    () => ({
      total: 0,
      page: 1,
      size: INVENTORY_PAGE_SIZE,
      setResponse: (response: { headers?: Record<string, unknown> }) => {
        const h = response.headers ?? {};
        const raw = h["x-total-count"] ?? h["X-Total-Count"];
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) {
          setTotalCount(n);
          paginator.total = n;
        }
        const pRaw = h["x-page"] ?? h["X-Page"];
        const p = Number(pRaw);
        if (Number.isFinite(p) && p >= 1) {
          paginator.page = p;
        }
      },
    }),
    [],
  );

  const fetchProducts = useCallback(
    async (query = "") => {
      try {
        setLoading(true);
        const response = await api.get("/products", {
          params: { q: query, page, size },
        });
        const { items } = normalizeListResponse(response);
        setProducts(items || []);
        // Sync total from X-Total-Count header (preferred) or fallback to body
        const headers = response.headers ?? {};
        const totalRaw = headers["x-total-count"] ?? headers["X-Total-Count"];
        const totalNum = Number(totalRaw);
        if (Number.isFinite(totalNum) && totalNum >= 0) {
          setTotalCount(totalNum);
          paginator.total = totalNum;
          paginator.page = page;
        } else {
          // Fallback: assume single-page result, total = items.length
          setTotalCount(items.length);
          paginator.total = items.length;
          paginator.page = 1;
        }
      } catch (err) {
        toast.error("فشل مزامنة المخزون");
        setProducts([]);
        setTotalCount(0);
        paginator.total = 0;
      } finally {
        setLoading(false);
      }
    },
    [page, size, paginator],
  );

  // Reset page to 1 whenever the search term changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts(searchTerm);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm, fetchProducts]);

  const productRows = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let baseList = productRows;
    if (activeTab === "active")
      baseList = baseList.filter((p) => !p.is_archived);
    else if (activeTab === "archived")
      baseList = baseList.filter((p) => p.is_archived);
    if (!query) return baseList;
    return baseList.filter((product) =>
      [
        product.name || "",
        product.category || "",
        product.description || "",
        product.sku || "",
        product.company_name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [productRows, searchTerm, activeTab]);

  const stats: InventoryStats = useMemo(() => {
    const active = productRows.filter((p) => !p.is_archived);
    const lowStock = active.filter(
      (p) => Number(p.quantity || 0) <= Number(p.min_quantity_alert || 0),
    );
    const inventoryCost = active.reduce(
      (sum, p) => sum + Number(p.quantity ?? 0) * getEstimatedUnitCost(p),
      0,
    );
    const inventoryVal = active.reduce((sum, p) => {
      const packs = getAvailablePacks(p);
      return (
        sum +
        (packs > 0
          ? packs * Number(p.sell_price ?? 0)
          : Number(p.quantity ?? 0) * Number(p.sell_price ?? 0))
      );
    }, 0);
    return {
      total: productRows.length,
      active: active.length,
      lowStock: lowStock.length,
      cost: inventoryCost,
      value: inventoryVal,
      archived: productRows.filter((p) => p.is_archived).length,
      uniqueCats: Array.from(new Set(active.map((p) => p.category))).length,
    };
  }, [productRows]);

  const uniqueCategories = useMemo(
    () =>
      Array.from(new Set(productRows.map((p) => p.category).filter(Boolean))),
    [productRows],
  );

  const getCategoryTone = useCallback(
    (product: Record<string, unknown>): CategoryTone => {
      const normalized = String(product?.category || "").toLowerCase();
      if (
        normalized.includes("زيت") ||
        normalized.includes("serum") ||
        normalized.includes("سيروم")
      ) {
        return {
          Icon: Droplets,
          badge: "زيوت وسيروم",
          iconClass: "bg-info-soft text-info",
        };
      }
      return {
        Icon: Box,
        badge: "مستلزمات وتشغيل",
        iconClass: "bg-primary-soft text-primary",
      };
    },
    [],
  );

  const handleExport = useCallback(
    async (type = "excel") => {
      const filename = `inventory_${new Date().toISOString().split("T")[0]}`;
      if (type === "excel") {
        await exportService.downloadExcel("/exports/products/excel", filename, {
          q: searchTerm,
        });
        return;
      }
      await exportService.downloadCsv("/exports/products/csv", filename, {
        q: searchTerm,
      });
    },
    [searchTerm],
  );

  return {
    products: productRows,
    loading,
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    fetchProducts,
    filteredProducts,
    stats,
    uniqueCategories,
    setProducts,
    STATIC_BASE_URL,
    getCategoryTone,
    handleExport,
    // Phase 2: pagination state
    page,
    setPage,
    size,
    totalCount,
    paginator,
  };
}