/**
 * usePagination — read X-Total-Count and friends from the most recent
 * response of a paginated endpoint.
 *
 * Usage:
 *   const { total, page, pageSize, headers } = usePagination();
 *   const items = await api.get("/customers?page=1&size=25");
 *   update();   // call after each response to refresh headers
 */
import { useCallback, useState } from "react";
import api from "@/services/api";

interface PaginationState {
  total: number;
  page: number;
  pageSize: number;
}

const initialState: PaginationState = {
  total: 0,
  page: 1,
  pageSize: 25,
};

/**
 * Helper that extracts pagination headers from an Axios response.
 * Falls back to the response body's `total` field if header missing.
 */
export function readPaginationHeaders(
  response: { headers?: Record<string, unknown>; data?: { total?: number } },
): PaginationState {
  const h = response.headers ?? {};
  const totalRaw =
    (h["x-total-count"] as string | undefined) ??
    (h["X-Total-Count"] as string | undefined);
  const pageRaw =
    (h["x-page"] as string | undefined) ??
    (h["X-Page"] as string | undefined);
  const pageSizeRaw =
    (h["x-page-size"] as string | undefined) ??
    (h["X-Page-Size"] as string | undefined);

  const total = totalRaw
    ? parseInt(totalRaw, 10)
    : (response.data?.total ?? 0);
  const page = pageRaw ? parseInt(pageRaw, 10) : 1;
  const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 25;

  return {
    total: Number.isFinite(total) ? total : 0,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  };
}

/**
 * Lightweight hook for components that fetch a paginated list directly
 * via axios and want to keep the pagination meta in React state.
 */
export function usePagination(initial: Partial<PaginationState> = {}) {
  const [state, setState] = useState<PaginationState>({
    ...initialState,
    ...initial,
  });

  const update = useCallback(
    (response: { headers?: Record<string, unknown>; data?: { total?: number } }) => {
      const next = readPaginationHeaders(response);
      setState(next);
      return next;
    },
    [],
  );

  return { ...state, update };
}

/**
 * Convenience wrapper — runs a paginated GET and returns
 * `{ items, pagination }` so callers don't have to remember the header
 * names. Use as a drop-in replacement for `api.get` in pagination UIs.
 *
 * Example:
 *   const { items, pagination } = await paginatedGet<Product>("/customers", {
 *     page: 2, size: 50, sort: "-created_at",
 *   });
 */
export async function paginatedGet<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ items: T[]; pagination: PaginationState }> {
  const response = await api.get<T[]>(url, { params });
  const pagination = readPaginationHeaders(response as unknown as {
    headers?: Record<string, unknown>;
    data?: { total?: number };
  });
  return {
    items: Array.isArray(response.data) ? response.data : [],
    pagination,
  };
}
