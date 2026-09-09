import { api } from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

interface NotificationMeta {
  page?: number;
  pageSize?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export const notificationService = {
  list: async (params: Record<string, unknown> = {}) => {
    const response = await api.get("/notifications", { params });
    const normalized = normalizeListResponse(response) as {
      items: unknown[];
      total: number;
      meta?: NotificationMeta;
    };
    return {
      items: normalized.items || [],
      total: normalized.total || 0,
      page: normalized.meta?.page ?? params.page ?? 1,
      page_size:
        normalized.meta?.pageSize ??
        params.page_size ??
        normalized.items?.length ??
        0,
      total_pages: normalized.meta?.totalPages ?? 1,
    };
  },
  markRead: async (notificationId: string | number) => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return normalizeItemResponse(response);
  },
  updateRead: async (
    notificationId: string | number,
    payload: { is_read?: boolean } & Record<string, unknown> = {},
  ) => {
    if (payload?.is_read === false) {
      return { id: notificationId, is_read: false };
    }
    return notificationService.markRead(notificationId);
  },
  markAllRead: async (notificationIds: (string | number)[] = []) => {
    const ids = notificationIds.filter(Boolean);
    if (!ids.length) {
      return { updated: 0 };
    }

    await Promise.all(ids.map((id) => api.patch(`/notifications/${id}/read`)));
    return { updated: ids.length };
  },
};
