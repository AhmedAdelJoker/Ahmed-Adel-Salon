import { api } from "./api";

const service = {
  list: async () => {
    const response = await api.get("/barbers");
    return response.data;
  },
  getById: async (barberId) => {
    const response = await api.get(`/barbers/${barberId}`);
    return response.data;
  },
  create: async (payload) => {
    const response = await api.post("/barbers", payload);
    return response.data;
  },
  update: async (barberId, payload) => {
    const response = await api.put(`/barbers/${barberId}`, payload);
    return response.data;
  },
  remove: async (barberId) => {
    const response = await api.delete(`/barbers/${barberId}`);
    return response.data;
  },
};

export const barbersService = service;
export const barberService = service;
