import { api } from "./api";

export const sessionService = {
  list: async () => {
    const response = await api.get("/sessions");
    return response.data;
  },
  getById: async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}`);
    return response.data;
  },
  create: async (payload) => {
    const response = await api.post("/sessions", payload);
    return response.data;
  },
  updateStatus: async (sessionId, status) => {
    const response = await api.patch(`/sessions/${sessionId}/status`, {
      status,
    });
    return response.data;
  },
};
