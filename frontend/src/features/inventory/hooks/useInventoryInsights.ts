import { useCallback, useEffect, useState } from "react";
import api from "@/services/api";
import type { InventoryInsights } from "@/features/inventory/insights";

/**
 * Fetches the shelf analytics behind the redesigned inventory screen.
 *
 * A failure here never breaks the page: the KPIs fall back to the plain
 * `/products/summary` numbers and the insights panel shows its own empty
 * state. Throwing through the page would turn one nice-to-have chart into a
 * museum of red text above the stock table.
 */
export function useInventoryInsights(days = 60, limit = 4) {
  const [insights, setInsights] = useState<InventoryInsights | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/products/insights", {
        params: { days, limit },
      });
      setInsights(res.data as InventoryInsights);
    } catch {
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [days, limit]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  return { insights, loading, refresh };
}

export default useInventoryInsights;
