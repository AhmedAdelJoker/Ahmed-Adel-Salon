import { api } from "./api";
import { normalizeItemResponse } from "./apiAdapter";

export const dashboardService = {
  ownerSummary: async () => {
    const response = await api.get("/dashboard/owner-summary");
    return normalizeItemResponse(response);
  },

  managerSummary: async () => {
    const response = await api.get("/dashboard/manager-summary");
    return normalizeItemResponse(response);
  },

  cashierSummary: async () => {
    const response = await api.get("/dashboard/cashier-summary");
    return normalizeItemResponse(response);
  },

  widgets: async () => {
    const response = await api.get("/dashboard/widgets");
    return normalizeItemResponse(response);
  },
};
