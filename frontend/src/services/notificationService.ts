import { api } from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";
import type { PaginatedResult } from "@/types/common";

export const notificationService = {
  list: async (params: Record<string, unknown> = {}) => {
    const response = await api.get("/notifications", { params });
    const normalized: PaginatedResult<any> = normalizeListResponse(response);
    return {
      items: (normalized.items as unknown[]) || [],
      total: (normalized.total as number) || 0,
      page: (normalized.meta as { page?: number })?.page ?? (params.page as number) ?? 1,
      page_size:
        (normalized.meta as { pageSize?: number })?.pageSize ??
        (params.page_size as number) ??
        ((normalized.items as unknown[])?.length ?? 0),
      total_pages: (normalized.meta as { totalPages?: number })?.totalPages ?? 1,
    };
  },
  markRead: async (notificationId: string | number) => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return normalizeItemResponse(response);
  },
  updateRead: async (notificationId: string | number, payload: Record<string, unknown> = {}) => {
    if (payload?.is_read === false) {
      return { id: notificationId, is_read: false };
    }
    return notificationService.markRead(notificationId);
  },
  markAllRead: async (notificationIds: Array<string | number> = []) => {
    const ids = notificationIds.filter(Boolean);
    if (!ids.length) {
      return { updated: 0 };
    }

    await Promise.all(ids.map((id) => api.patch(`/notifications/${id}/read`)));
    return { updated: ids.length };
  },
};
