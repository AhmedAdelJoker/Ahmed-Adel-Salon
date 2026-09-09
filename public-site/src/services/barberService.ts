import { api } from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

/**
 * Barber Operational Service: Real-time queue and productivity management.
 */
export const barberService = {
  getStats: async (period = "today") => {
    const response = await api.get("/barber/stats", {
      params: { period },
    });
    return normalizeItemResponse(response);
  },

  getQueue: async () => {
    const response = await api.get("/barber/queue");
    return normalizeListResponse(response);
  },

  updateStatus: async (appointmentId, status) => {
    const response = await api.post(
      `/barber/update-status/${appointmentId}`,
      null,
      {
        params: { status },
      },
    );
    return normalizeItemResponse(response);
  },

  list: async () => {
    const response = await api.get("/barbers");
    return normalizeListResponse(response);
  },

  getById: async (barberId) => {
    const response = await api.get(`/barbers/${barberId}`);
    return normalizeItemResponse(response);
  },

  create: async (payload) => {
    const response = await api.post("/barbers", payload);
    return normalizeItemResponse(response);
  },

  update: async (barberId, payload) => {
    const response = await api.put(`/barbers/${barberId}`, payload);
    return normalizeItemResponse(response);
  },

  remove: async (barberId) => {
    const response = await api.delete(`/barbers/${barberId}`);
    return normalizeItemResponse(response);
  },
};

export const barbersService = barberService;
