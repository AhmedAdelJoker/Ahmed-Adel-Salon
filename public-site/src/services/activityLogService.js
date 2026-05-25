import { api } from "./api";
import { normalizeListResponse } from "./apiAdapter";

function buildListParams(params = {}) {
  const next = { ...params };
  const page = Number(next.page || 1);
  const pageSize = Number(next.page_size || next.limit || 20);

  if (next.skip == null) {
    next.skip = Math.max(0, (page - 1) * pageSize);
  }

  if (next.limit == null) {
    next.limit = pageSize;
  }

  delete next.page;
  delete next.page_size;

  return next;
}

export const activityLogService = {
  list: async (params = { page: 1, page_size: 20 }) => {
    const response = await api.get("/activity-logs", {
      params: buildListParams(params),
    });
    return normalizeListResponse(response);
  },
};
