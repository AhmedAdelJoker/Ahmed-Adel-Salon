import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { normalizeEmployeeRecord } from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";
import type { ServiceRecord } from "@/types/catalog";
import type { HrStats, HrViewMode } from "@/features/hr/types";

/**
 * HR board listing data: fetch, search filter and derived stats.
 * Extracted from pages/owner/HRManagement (Phase 3).
 */
export function useHrData() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [allServices, setAllServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<HrViewMode>("cards");
  // Phase 2: server-side pagination
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, servRes] = await Promise.all([
        api.get("/employees", { params: { page, page_size: size } }),
        api.get("/services", { params: { limit: 1000 } }),
      ]);
      setEmployees(
        normalizeListResponse(empRes).items.map(normalizeEmployeeRecord),
      );
      setAllServices(servRes.data || []);

      // Phase 2: read X-Total-Count header
      const headers = (empRes as { headers?: Record<string, unknown> }).headers ?? {};
      const headerTotal = headers["x-total-count"] ?? headers["X-Total-Count"];
      const n = Number(headerTotal);
      if (Number.isFinite(n) && n >= 0) {
        setTotalCount(n);
      } else {
        const items = normalizeListResponse(empRes).items;
        setTotalCount(items.length < size && page === 1 ? items.length : items.length + (page - 1) * size);
      }
    } catch (_error) {
      toast.error("فشل تحميل بيانات الموظفين");
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    let result = employees.filter((emp) => emp.status === "active");
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.fullName?.toLowerCase().includes(q) ||
          emp.phonePrimary?.includes(q) ||
          emp.jobTitle?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [employees, searchTerm]);

  const stats: HrStats = useMemo(() => {
    const active = employees.filter((e) => e.status === "active").length;
    const barbers = employees.filter(
      (e) => e.jobTitle === "barber" && e.status === "active",
    ).length;
    const assistants = employees.filter(
      (e) => e.jobTitle === "barber_assistant" && e.status === "active",
    ).length;
    return { active, assistants, barbers, total: employees.length };
  }, [employees]);

  return {
    employees,
    setEmployees,
    allServices,
    setAllServices,
    loading,
    searchTerm,
    setSearchTerm,
    activeView,
    setActiveView,
    filteredEmployees,
    stats,
    fetchEmployees,
    // Phase 2: pagination
    page,
    setPage,
    size,
    totalCount,
  };
}
