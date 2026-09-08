import { api } from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

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

  // Calendar view
  getCalendar: async (month = null) => {
    const params = month ? { month } : {};
    const response = await api.get("/barber/calendar", { params });
    return normalizeItemResponse(response);
  },

  // Performance data for charts
  getPerformance: async (days = 7) => {
    const response = await api.get("/barber/performance", { params: { days } });
    return normalizeItemResponse(response);
  },

  // Schedule for a specific date
  getSchedule: async (date = null) => {
    const params = date ? { date } : {};
    const response = await api.get("/barber/schedule", { params });
    return normalizeItemResponse(response);
  },

  getAppointmentById: async (id) => {
    const response = await api.get(`/barber/appointments/${id}`);
    return normalizeItemResponse(response);
  },
};

export const barbersService = barberService;
