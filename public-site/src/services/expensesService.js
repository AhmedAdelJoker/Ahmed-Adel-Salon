import { api } from "./api";
import { cleanParams } from "./exportService";

export const expensesService = {
  archive: async (params = {}) => {
    const response = await api.get("/expenses/archive", {
      params: cleanParams(params),
    });
    return response.data;
  },
};
