import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import api from "@/services/api";
import { normalizeListResponse } from "@/services/apiAdapter";
import { normalizeEmployeeRecord } from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";
import type { ServiceRecord } from "@/types/catalog";
import type { HrStats, HrStatusFilter, HrViewMode } from "@/features/hr/types";

const EMPTY_STATS: HrStats = {
  total: 0,
  active: 0,
  suspended: 0,
  resigned: 0,
  barbers: 0,
  assistants: 0,
};

/**
 * One keystroke, one request is not a search on a roster — it is a denial of
 * service the owner writes against themselves. The board waits for the pause.
 */
const SEARCH_DEBOUNCE_MS = 350;

/** The two views are a reading preference, not a session setting. */
const VIEW_STORAGE_KEY = "hr.viewMode";

const readStoredView = (): HrViewMode => {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "table" || stored === "cards" ? stored : "cards";
  } catch {
    // Private-mode Safari throws on localStorage access. Cards is a fine default.
    return "cards";
  }
};

/**
 * HR board listing data: fetch, search filter and derived stats.
 *
 * Search, filtering, counting and the stats row all run on the server. They
 * used to run on whatever 50 rows the current page happened to hold, which
 * produced two failures the owner could see: typing a name that was on page 2
 * answered "no employees found", and "total staff" changed when the page
 * changed.
 *
 * The employee list is the page. Services only feed the hire/edit wizard and
 * stats are a readout, so neither is allowed to take the list down with it:
 * a failed `/services` call used to blank a roster that had already loaded.
 */
export function useHrData() {
  const { t } = useTranslation("owner");

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [allServices, setAllServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HrStatusFilter>("all");
  const [activeView, setActiveViewState] = useState<HrViewMode>(readStoredView);
  const [page, setPage] = useState(1);
  const [size] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<HrStats>(EMPTY_STATS);

  // One toast per outage, not one per retry/page change.
  const errorNotified = useRef(false);

  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [searchTerm]);

  // A new question is a new answer set: page 3 of the old search is not a page
  // of the new one, and staying there shows an empty list under a count.
  // Clear stale rows immediately so a failed/slow fetch cannot present old
  // results as if they match the new filter (e.g. active rows under "suspended").
  useEffect(() => {
    setPage(1);
    setEmployees([]);
    setTotalCount(0);
    setLoading(true);
  }, [debouncedSearch, statusFilter]);

  const setActiveView = useCallback((view: HrViewMode) => {
    setActiveViewState(view);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // The preference simply does not survive a reload in private mode.
    }
  }, []);

  /**
   * Services are fetched once, not on every page/search change: the only
   * consumer is the form's skills step, and `/services?limit=1000` is the
   * heaviest request the board made.
   */
  const fetchServices = useCallback(async () => {
    try {
      const response = await api.get("/services", { params: { limit: 1000 } });
      setAllServices(response.data || []);
    } catch {
      // The wizard offers an empty service list; the roster is unaffected.
    }
  }, []);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  /**
   * The strip is a readout, not a gate. On failure it keeps the last good
   * numbers rather than replacing the whole board with an error.
   */
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get("/employees/stats");
      setStats({ ...EMPTY_STATS, ...(response.data || {}) });
    } catch {
      // Keep the previous aggregate; the next successful refresh corrects it.
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/employees", {
        params: {
          page,
          page_size: size,
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(statusFilter === "all"
            ? { excludeStatus: "resigned" }
            : { status: statusFilter }),
        },
      });

      const normalized = normalizeListResponse(response);
      setEmployees(normalized.items.map(normalizeEmployeeRecord));

      const headers =
        (response as { headers?: Record<string, unknown> }).headers ?? {};
      const headerTotal = headers["x-total-count"] ?? headers["X-Total-Count"];
      const parsedTotal = Number(headerTotal);
      setTotalCount(
        Number.isFinite(parsedTotal) && parsedTotal >= 0
          ? parsedTotal
          : normalized.items.length,
      );

      setLoadError(false);
      errorNotified.current = false;
      // Independent: a slow stats endpoint must not hold the roster hostage.
      void fetchStats();
    } catch {
      setLoadError(true);
      setEmployees([]);
      setTotalCount(0);
      if (!errorNotified.current) {
        errorNotified.current = true;
        toast.error(t("hr.loadFailed"));
      }
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  }, [page, size, debouncedSearch, statusFilter, fetchStats, t]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    // The server already excluded leavers; this is the same rule stated once
    // more, because a `resigned` row in the team list is the row an owner then
    // books a cut for.
    return employees.filter((emp) => emp.status !== "resigned");
  }, [employees]);

  // True while the typed question and the answered one differ, or while a
  // search request is in flight. Page changes are not searches.
  const searchPending =
    searchTerm.trim() !== debouncedSearch ||
    (loading && debouncedSearch.length > 0);

  return {
    employees,
    setEmployees,
    allServices,
    setAllServices,
    loading,
    isInitialLoading,
    loadError,
    searchPending,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    activeView,
    setActiveView,
    filteredEmployees,
    stats,
    fetchEmployees,
    page,
    setPage,
    size,
    totalCount,
  };
}
