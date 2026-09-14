import api from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

const offerService = {
  list: () => api.get("/offers").then(normalizeListResponse),
  active: () => api.get("/offers/active").then(normalizeListResponse),
  getById: (id) => api.get(`/offers/${id}`).then(normalizeItemResponse),
  create: (data) => api.post("/offers", data).then(normalizeItemResponse),
  update: (id, data) =>
    api.put(`/offers/${id}`, data).then(normalizeItemResponse),
  remove: (id) => api.delete(`/offers/${id}`).then(normalizeItemResponse),
  toggleActive: (id) =>
    api.patch(`/offers/${id}/toggle-active`).then(normalizeItemResponse),
};

export default offerService;
