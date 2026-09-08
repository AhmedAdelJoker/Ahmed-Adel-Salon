import api from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

const expenseService = {
  list: (params) =>
    api.get("/expenses", { params }).then(normalizeListResponse),
  summary: () => api.get("/expenses/summary").then(normalizeItemResponse),
  archive: (params) =>
    api.get("/expenses/archive", { params }).then(normalizeListResponse),
  create: (payload) =>
    api.post("/expenses", payload).then(normalizeItemResponse),
  update: (id, payload) =>
    api.put(`/expenses/${id}`, payload).then(normalizeItemResponse),
  remove: (id) => api.delete(`/expenses/${id}`).then(normalizeItemResponse),
};

export default expenseService;
