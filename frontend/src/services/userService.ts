import { api } from "@/services/api";

export const userService = {
  list: async () => {
    const response = await api.get("/users");
    return response.data;
  },
  getById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  create: async (payload) => {
    const response = await api.post("/users", payload);
    return response.data;
  },
  updateRole: async (userId, role) => {
    const response = await api.patch(`/users/${userId}/role`, { role });
    return response.data;
  },
  updateActive: async (userId, is_active) => {
    const response = await api.patch(`/users/${userId}/active`, { is_active });
    return response.data;
  },
};
