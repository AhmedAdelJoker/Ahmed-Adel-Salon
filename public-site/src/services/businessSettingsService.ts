import { api } from "./api";
import { normalizeItemResponse } from "./apiAdapter";

export const businessSettingsService = {
  get: async () => {
    const response = await api.get("/business-settings");
    return normalizeItemResponse(response);
  },

  update: async (payload) => {
    const response = await api.put("/business-settings", payload);
    return normalizeItemResponse(response);
  },

  uploadLogo: async (formData) => {
    const response = await api.post("/business-settings/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return normalizeItemResponse(response);
  },

  publishSite: async () => {
    const response = await api.post("/business-settings/publish-site");
    return normalizeItemResponse(response);
  },

  getWhatsAppStatus: async () => {
    const response = await api.get("/integrations/whatsapp/status");
    return normalizeItemResponse(response);
  },

  sendWhatsAppTest: async (payload) => {
    const response = await api.post("/integrations/whatsapp/test", payload);
    return normalizeItemResponse(response);
  },
};
