/**
 * API Response Adapter
 * يوحّد شكل ردود الـ API في مكان واحد لضمان استقرار الواجهة الأمامية.
 */

import type { PaginatedResult } from "@/types/common";

type UnknownRecord = Record<string, unknown>;

 
export const unwrapResponse = (response: any): any => {
  if (response && typeof response === "object") {
    if ("data" in response && response.data !== null) return response.data;
    return response;
  }

  return response ?? null;
};

 
/**
 * Read X-Total-Count / X-Page / X-Page-Size from an Axios response.
 * Phase 2: when the backend emits these pagination headers we prefer them
 * over body fields, since they reflect the full server-side count even
 * when the response body is truncated.
 */
const readHeaderCount = (
  response: unknown,
  key: string,
): number | null => {
  if (!response || typeof response !== "object") return null;
  const headers = (response as UnknownRecord).headers as
    | Record<string, unknown>
    | undefined;
  if (!headers) return null;
  const value = headers[key] ?? headers[key.toLowerCase()];
  if (value == null) return null;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeListResponse = <T = any>(response: unknown): PaginatedResult<T> => {
  const raw = unwrapResponse(response) as unknown;

  // Phase 2: prefer X-Total-Count header when present
  const headerTotal = readHeaderCount(response, "x-total-count");

  if (!raw) {
    return headerTotal != null
      ? { items: [], total: headerTotal }
      : { items: [], total: 0 };
  }

  if (Array.isArray(raw)) {
    return { items: raw as T[], total: headerTotal ?? raw.length };
  }

  if (typeof raw === "object") {
    const obj = raw as UnknownRecord;
    const listKeys = [
      "items",
      "data",
      "results",
      "rows",
      "records",
      "list",
      "chart_data",
    ];
    const listKey = listKeys.find((key) => Array.isArray(obj[key]));

    if (listKey) {
      const items = obj[listKey] as T[];
      const total =
        headerTotal
        ?? (Number(obj.total ?? obj.count ?? obj.total_count ?? items.length) || items.length);
      return { items, total };
    }

    return {
      items: [],
      total: headerTotal ?? (Number(obj.total ?? obj.count ?? 0) || 0),
    };
  }

  return { items: [], total: headerTotal ?? 0 };
};

 
export const normalizeItemResponse = <T = any>(response: unknown, fallback: T | null = null): T | null => {
  const raw = unwrapResponse(response) as unknown;

  if (!raw) return fallback;

  if (Array.isArray(raw)) return (raw[0] as T) ?? fallback;

  if (typeof raw !== "object") return fallback;

  const obj = raw as UnknownRecord;
  if (Array.isArray(obj.items)) return (obj.items[0] as T) ?? fallback;
  if (Array.isArray(obj.data)) return (obj.data[0] as T) ?? fallback;
  if (obj.item && typeof obj.item === "object") return obj.item as T;
  if (obj.record && typeof obj.record === "object") return obj.record as T;
  if (obj.result && typeof obj.result === "object") return obj.result as T;

  return raw as T;
};

 
export const adaptApiResponse = <T = any>(res: unknown) => {
  const normalized = normalizeListResponse<T>(res);
  return {
    ...normalized,
    raw: unwrapResponse(res),
  };
};

 
export const adaptList = <T = any>(res: unknown): T[] => normalizeListResponse<T>(res).items;
 
export const adaptTotal = (res: unknown): number => normalizeListResponse(res).total;
export const adaptItem = normalizeItemResponse;
export const adaptObject = normalizeItemResponse;
