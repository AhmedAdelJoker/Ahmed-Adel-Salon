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
 */
export function useInventoryData() {
   
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("active");

  const STATIC_BASE_URL = useMemo(
    () => baseURL.replace("/api/v1", ""),
    [],
  );

  const fetchProducts = useCallback(async (query = "") => {
    try {
      setLoading(true);
      const response = await api.get("/products", { params: { q: query } });
      setProducts(normalizeListResponse(response).items || []);
    } catch (err) {
      toast.error("فشل مزامنة المخزون");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
  };
}