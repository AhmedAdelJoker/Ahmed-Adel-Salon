import { useCallback, useEffect, useMemo, useState } from "react";

import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";

export interface DailyPoint {
  date: string;
  revenue: number;
  appointments: number;
  is_today: boolean;
}

export interface RankedBarber {
  name: string;
  invoices: number;
  revenue: number;
}

export interface RankedService {
  name: string;
  count: number;
  revenue: number;
}

export interface DayStatus {
  now: string;
  is_open: boolean;
  open_shift: {
    id: number;
    user_id: number;
    opening_cash: number;
    opened_at: string | null;
    hours_open: number | null;
    overdue: boolean;
  } | null;
  last_closed_at: string | null;
  last_closing_cash: number | null;
}

export interface OperatingSummary {
  /** null when the server could not build the series. Not an empty array. */
  daily: DailyPoint[] | null;
  previous_window_average: number | null;
  top_barbers: RankedBarber[] | null;
  top_services: RankedService[] | null;
  day_status: DayStatus | null;
  generated_at: string;
}

export interface UseOperatingSummaryReturn {
  summary: OperatingSummary | null;
  loading: boolean;
  /** Section-level availability, so one failed panel cannot blank the cockpit. */
  failures: {
    daily: boolean;
    barbers: boolean;
    services: boolean;
    status: boolean;
  };
  error: string | null;
  reload: () => void;
}

const NOTHING: OperatingSummary = {
  daily: null,
  previous_window_average: null,
  top_barbers: null,
  top_services: null,
  day_status: null,
  generated_at: "",
};

/**
 * Feeds the redesigned cockpit: daily sparkline, staff and service rankings, and
 * the state of the trading day.
 *
 * Deliberately separate from `useReportsDashboard`, which owns the period-scoped
 * KPIs and the demo-mode logic. Mixing them would mean one hook deciding whether
 * a figure is real, and the "did this section load" answer here would have to be
 * reconciled against that decision. Keeping them apart means the period selector
 * cannot change what "the salon is open right now" means.
 */
export function useOperatingSummary(days = 14): UseOperatingSummaryReturn {
  const [summary, setSummary] = useState<OperatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/owner/operating-summary", {
        params: { days },
      });
      const data = adaptObject(res.data) as OperatingSummary;
      setSummary({ ...NOTHING, ...data });
    } catch (err) {
      // The whole request failing means every section is unavailable. Each panel
      // says so individually rather than the cockpit showing one global banner
      // and empty boxes that look like zeroes.
      setSummary(null);
      setError(loadErrorMessage(err, "تعذّر تحميل ملخّص التشغيل"));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const failures = useMemo(
    () => ({
      daily: !summary || summary.daily === null,
      barbers: !summary || summary.top_barbers === null,
      services: !summary || summary.top_services === null,
      status: !summary || summary.day_status === null,
    }),
    [summary],
  );

  return { summary, loading, failures, error, reload: load };
}