import { api } from "@/services/api";

export const serviceService = {
  list: async (params = { page: 1, page_size: 20 }) =>
    api.get("/services", { params }),
  getById: async (serviceId) => api.get(`/services/${serviceId}`),
  create: async (payload) => api.post("/services", payload),
  update: async (serviceId, payload) =>
    api.put(`/services/${serviceId}`, payload),
  remove: async (serviceId) => api.delete(`/services/${serviceId}`),
};
