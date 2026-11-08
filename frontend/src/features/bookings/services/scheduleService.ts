import { api } from "@/services/api";

export const scheduleService = {
  listAppointments: async (params?: {
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await api.get("/appointments", {
      params: {
        date_filter: params ? "custom" : undefined,
        start_date: params?.startDate,
        end_date: params?.endDate,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  listBarbers: async () => {
    const response = await api.get("/barbers");
    return Array.isArray(response.data) ? response.data : [];
  },

  // يحتاج endpoint backend يدعم تعديل barber_id / appointment_date / appointment_time
  moveAppointment: async (appointmentId, payload) => {
    const response = await api.patch(`/appointments/${appointmentId}`, payload);
    return response.data;
  },
};
