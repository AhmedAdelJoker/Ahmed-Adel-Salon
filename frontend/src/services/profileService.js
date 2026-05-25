import { api } from "./api";

export const profileService = {
  get: async () => {
    const response = await api.get("/profile");
    return response.data;
  },

  update: async (payload) => {
    const response = await api.put("/profile", payload);
    return response.data;
  },

  changePassword: async (payload) => {
    const response = await api.post("/profile/change-password", payload);
    return response.data;
  },
};
