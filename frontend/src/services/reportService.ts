import api from "@/services/api";
import { cleanParams } from "@/services/exportService";

export const reportService = {
  overview: async () => {
    const response = await api.get("/reports/");
    return response.data;
  },

  revenue: async (params = {}) => {
    const response = await api.get("/reports/revenue-analytics", {
      params: cleanParams(params),
    });

    return response.data;
  },

  daily: async (params = {}) => {
    const response = await api.get("/reports/daily", {
      params: cleanParams(params),
    });

    return response.data;
  },

  commissions: async (params = {}) => {
    const response = await api.get("/reports/commissions", {
      params: cleanParams(params),
    });

    return response.data;
  },

  getCashTransactions: async (params = {}) => {
    const response = await api.get("/cashbox/transactions", {
      params: cleanParams(params),
    });
    return response.data;
  },
};

export default reportService;
