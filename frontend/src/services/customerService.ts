import { api } from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

export const customerService = {
  list: async (params = { page: 1, page_size: 20 }) => {
    const response = await api.get("/customers", { params });
    return normalizeListResponse(response);
  },

  getById: async (customerId) => {
    const response = await api.get(`/customers/${customerId}`);
    return normalizeItemResponse(response);
  },

  create: async (payload) => {
    const response = await api.post("/customers", payload);
    return normalizeItemResponse(response);
  },

  update: async (customerId, payload) => {
    const response = await api.put(`/customers/${customerId}`, payload);
    return normalizeItemResponse(response);
  },

  remove: async (customerId) => {
    const response = await api.delete(`/customers/${customerId}`);
    return normalizeItemResponse(response);
  },
};
