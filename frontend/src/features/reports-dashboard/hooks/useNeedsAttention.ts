import { useCallback, useEffect, useState } from "react";

import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import { loadErrorMessage } from "@/lib/core/asyncError";
import type {
  OwnerAlert,
  OwnerAlertsPayload,
} from "@/features/owner-alerts/types";

export interface UseNeedsAttentionReturn {
  alerts: OwnerAlert[];
  counts: { total: number; high: number; medium: number; low: number };
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * "What needs you" on `/owner`.
 *
 * Reads the same `/owner/alerts` aggregate the alerts page uses, rather than a
 * second endpoint that would have to agree with it. Two sources for one
 * question is how a count on the dashboard starts disagreeing with the page you
 * click through to from it.
 *
 * `limit` is small because this is a summary. The backend counts before it
 * slices, so the totals shown here are the real totals and not "how many fit in
 * the card".
 *
 * Alerts are not period-scoped. A pending approval has no date range, and
 * filtering "what needs you" by the revenue chart's selected period would hide
 * a request that is still sitting there.
 */
export function useNeedsAttention(limit = 4): UseNeedsAttentionReturn {
  const [alerts, setAlerts] = useState<OwnerAlert[]>([]);
  const [counts, setCounts] = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/owner/alerts", { params: { limit } });
      const data = adaptObject(res.data) as OwnerAlertsPayload;

      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setCounts(
        data.counts ?? { total: 0, high: 0, medium: 0, low: 0 },
      );
    } catch (err) {
      // Deliberately does not zero the counts. "The request failed" and
      // "nothing is pending" look identical on a dashboard, and only one of
      // them is good news.
      setError(loadErrorMessage(err, "تعذّر تحميل ما يحتاج انتباهك"));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { alerts, counts, loading, error, reload: load };
}