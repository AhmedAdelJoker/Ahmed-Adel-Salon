import { api } from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

export const bookingService = {
  list: async (params = {}) => {
    const response = await api.get("/appointments", { params });
    return normalizeListResponse(response);
  },

  getById: async (id) => {
    const response = await api.get(`/appointments/${id}`);
    return normalizeItemResponse(response);
  },

  create: async (payload) => {
    const response = await api.post("/appointments", payload);
    return normalizeItemResponse(response);
  },

  cancel: async (id) => {
    const response = await api.patch(`/appointments/${id}/status`, {
      status: "cancelled",
    });
    return normalizeItemResponse(response);
  },

  start: async (id) => {
    const response = await api.patch(`/appointments/${id}/status`, {
      status: "in-service",
    });
    return normalizeItemResponse(response);
  },

  complete: async (id) => {
    const response = await api.patch(`/appointments/${id}/status`, {
      status: "completed",
    });
    return normalizeItemResponse(response);
  },
};

export default bookingService;
