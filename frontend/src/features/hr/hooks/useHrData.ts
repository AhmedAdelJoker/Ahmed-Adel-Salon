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

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const [empRes, servRes] = await Promise.all([
        api.get("/employees"),
        api.get("/services", { params: { limit: 1000 } }),
      ]);
      setEmployees(
        normalizeListResponse(empRes).items.map(normalizeEmployeeRecord),
      );
      setAllServices(servRes.data || []);
    } catch (_error) {
      toast.error("فشل تحميل بيانات الموظفين");
    } finally {
      setLoading(false);
    }
  }, []);

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
  };
}
