/**
 * usePaginatedList — small hook combining `createPaginationState` with
 * a React state model. The canonical pattern for Phase 2 paginated UIs.
 *
 * Usage:
 *   const { items, loading, error, paginator, page, size, setPage, setSize, refresh } =
 *     usePaginatedList<Product>({ endpoint: "/products", initialSize: 25 });
 *
 *   return (
 *     <>
 *       <ProductList items={items} />
 *       <Pagination paginator={paginator} onPageChange={setPage} onSizeChange={(s) => { setSize(s); setPage(1); }} />
 *     </>
 *   );
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import {
  createPaginationState,
  type PaginationState,
} from "@/components/shared/Pagination";

interface UsePaginatedListOptions {
  endpoint: string;
  initialPage?: number;
  initialSize?: number;
  extraParams?: Record<string, unknown>;
  /** Auto-fetch on mount + when page/size changes (default true) */
  autoFetch?: boolean;
}

export function usePaginatedList<T = unknown>({
  endpoint,
  initialPage = 1,
  initialSize = 25,
  extraParams,
  autoFetch = true,
}: UsePaginatedListOptions) {
  const [page, setPage] = useState(initialPage);
  const [size, setSize] = useState(initialSize);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep a stable paginator instance so the Pagination component can read .total
  const paginator = useMemo<PaginationState>(
    () => createPaginationState({ page, size }),
    [], // intentionally never recreated — we mutate via setResponse
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<T[] | { items: T[]; total: number }>(
        endpoint,
        { params: { page, size, ...(extraParams ?? {}) } },
      );
      const data = response.data;
      // Two shapes: bare array OR envelope { items, total }
      if (Array.isArray(data)) {
        setItems(data as T[]);
      } else if (data && Array.isArray(data.items)) {
        setItems(data.items as T[]);
      } else {
        setItems([]);
      }
      // Update the paginator state from headers (X-Total-Count etc.)
      paginator.setResponse(response as unknown as {
        headers?: Record<string, unknown>;
        data?: { total?: number };
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, size, extraParams, paginator]);

  useEffect(() => {
    if (autoFetch) {
      void fetchData();
    }
  }, [autoFetch, fetchData]);

  return {
    items,
    loading,
    error,
    paginator,
    page,
    size,
    setPage,
    setSize,
    refresh: fetchData,
  };
}
