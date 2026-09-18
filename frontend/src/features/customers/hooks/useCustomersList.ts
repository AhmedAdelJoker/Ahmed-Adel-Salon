/**
 * Customers list state + fetching (server-side search / filter / pagination).
 *
 * The backend list endpoint supports `limit`/`offset`/`q`/`segment` and
 * reports the filtered total via the `X-Total-Count` response header, so
 * this hook scales to very large datasets: only one page of rows is ever
 * held in memory. System-wide KPIs come from `GET /customers/stats`.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { exportService } from "@/services/exportService";
import { CUSTOMERS_PAGE_SIZE } from "@/features/customers/constants";
import { customerId } from "@/features/customers/utils/customer";

const SEGMENT_BY_FILTER: Record<string, string> = {
  "الكل": "all",
  VIP: "vip",
  "منتظم": "regular",
  "جديد": "new",
};

export interface CustomerStats {
  total: number;
  vip_count: number;
  regular_count: number;
  new_count: number;
  avg_spend: number;
  duplicate_group_count: number;
  duplicate_customer_count: number;
}

export const EMPTY_CUSTOMER_STATS: CustomerStats = {
  total: 0,
  vip_count: 0,
  regular_count: 0,
  new_count: 0,
  avg_spend: 0,
  duplicate_group_count: 0,
  duplicate_customer_count: 0,
};

function readTotal(res: unknown, fallback: number): number {
  const headers = (res as { headers?: Record<string, unknown> } | null)?.headers;
  const raw = headers?.["x-total-count"] ?? headers?.["X-Total-Count"];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readStats(res: unknown): CustomerStats {
  const data = (res as { data?: Record<string, unknown> } | null)?.data ?? {};
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  return {
    total: num(data.total),
    vip_count: num(data.vip_count),
    regular_count: num(data.regular_count),
    new_count: num(data.new_count),
    avg_spend: num(data.avg_spend),
    duplicate_group_count: num(data.duplicate_group_count),
    duplicate_customer_count: num(data.duplicate_customer_count),
  };
}

export function useCustomersList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilterState] = useState("الكل");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'table'

  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  /** Filtered total for the current query (drives pagination). */
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<CustomerStats>(EMPTY_CUSTOMER_STATS);

  async function handleExport(type = "excel") {
    const filename = `customers_${new Date().toISOString().split("T")[0]}`;
    if (type === "excel") {
      await exportService.downloadExcel("/exports/customers/excel", filename, {
        q: debouncedSearch,
      });
    } else {
      await exportService.downloadCsv("/exports/customers/csv", filename, {
        q: debouncedSearch,
      });
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const changeFilter = useCallback((filter: string) => {
    setActiveFilterState(filter);
    setCurrentPage(1);
  }, []);

  const removeCustomer = useCallback((id) => {
    setCustomers((prev) => prev.filter((c) => customerId(c) !== id));
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/customers/stats");
      setStats(readStats(res));
    } catch (error) {
      console.error("Customers stats error:", error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * CUSTOMERS_PAGE_SIZE;
      const [response] = await Promise.all([
        api.get("/customers", {
          params: {
            limit: CUSTOMERS_PAGE_SIZE,
            offset,
            q: debouncedSearch.trim() || undefined,
            segment: SEGMENT_BY_FILTER[activeFilter] ?? "all",
          },
        }),
        fetchStats(),
      ]);
      const { items } = normalizeListResponse(response);
      setCustomers(items);
      setTotalCount(readTotal(response, items.length));
    } catch (error) {
      console.error("Customers fetch error:", error);
      toast.error("فشل في تحميل بيانات العملاء");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, activeFilter, fetchStats]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalPages = Math.max(1, Math.ceil(totalCount / CUSTOMERS_PAGE_SIZE));

  return {
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter: changeFilter,
    viewMode,
    setViewMode,
    customers,
    loading,
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    stats,
    fetchCustomers,
    removeCustomer,
    handleExport,
  };
}
