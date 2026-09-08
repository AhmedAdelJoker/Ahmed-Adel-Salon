import { api } from "@/services/api";

export const appointmentService = {
  list: async (params = { page: 1, page_size: 25 }) => {
    return api.get("/appointments", { params });
  },

  getById: async (appointmentId) => {
    return api.get(`/appointments/${appointmentId}`);
  },

  create: async (payload) => {
    return api.post("/appointments", payload);
  },

  update: async (appointmentId, payload) => {
    return api.put(`/appointments/${appointmentId}`, payload);
  },

  updateStatus: async (appointmentId, payload) => {
    return api.patch(`/appointments/${appointmentId}/status`, payload);
  },

  sendConfirmation: async (appointmentId) => {
    return api.post(`/appointments/${appointmentId}/send-confirmation`);
  },

  sendReminder: async (appointmentId) => {
    return api.post(`/appointments/${appointmentId}/send-reminder`);
  },

  issueInvoice: async (appointmentId) => {
    return api.post(`/appointments/${appointmentId}/issue-invoice`);
  },

  checkCustomerDuplicate: async (customerId, date, excludeId = null) => {
    return api.get("/appointments/check-customer-duplicate", {
      params: { customer_id: customerId, date, exclude_id: excludeId },
    });
  },

  remove: async (appointmentId) => {
    return api.delete(`/appointments/${appointmentId}`);
  },
};
