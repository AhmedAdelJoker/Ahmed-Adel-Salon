/**
 * Customers list state + fetching (moved from Customers page, no logic changes).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { exportService } from "@/services/exportService";
import { CUSTOMERS_PAGE_SIZE } from "@/features/customers/constants";
import { customerId } from "@/features/customers/utils/customer";

export function useCustomersList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'table'
   
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const duplicateGroups = useMemo(() => {
    const phoneMap = new Map();
    customers.forEach((c) => {
      const phone = String(c.phone || "").replace(/\s+/g, "");
      if (!phone) return;
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone).push(c);
    });
    return Array.from(phoneMap.values()).filter((group) => group.length > 1);
  }, [customers]);
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
  const removeCustomer = useCallback((id) => {
    setCustomers((prev) => prev.filter((c) => customerId(c) !== id));
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * CUSTOMERS_PAGE_SIZE;
      const response = await api.get("/customers", {
        params: { skip, limit: CUSTOMERS_PAGE_SIZE, q: debouncedSearch },
      });
      const { items, total } = normalizeListResponse(response);
      setCustomers(items);
      setTotalCount(total || items.length);
    } catch (error) {
      console.error("Customers fetch error:", error);
      toast.error("فشل في تحميل بيانات العملاء");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const visits = Number(customer.visits_count || customer.visits || 0);
      if (activeFilter === "VIP") return visits > 10;
      if (activeFilter === "منتظم") return visits >= 2 && visits <= 10;
      if (activeFilter === "جديد") return visits <= 1;
      return true;
    });
  }, [customers, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(totalCount / CUSTOMERS_PAGE_SIZE));

  return {
    searchTerm,
    setSearchTerm,
    activeFilter,
    setActiveFilter,
    viewMode,
    setViewMode,
    customers,
    loading,
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    duplicateGroups,
    filteredCustomers,
    fetchCustomers,
    removeCustomer,
    handleExport,
  };
}
