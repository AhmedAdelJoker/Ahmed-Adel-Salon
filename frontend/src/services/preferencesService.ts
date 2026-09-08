import { api } from "@/services/api";

export const preferencesService = {
  get: async () => {
    return api.get("/preferences");
  },

  update: async (payload) => {
    return api.put("/preferences", payload);
  },
};
