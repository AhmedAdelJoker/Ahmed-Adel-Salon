import api from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

const serviceCategoryService = {
  list: () => api.get("/service-categories").then(normalizeListResponse),
  getById: (id) =>
    api.get(`/service-categories/${id}`).then(normalizeItemResponse),
  create: (data) =>
    api.post("/service-categories", data).then(normalizeItemResponse),
  update: (id, data) =>
    api.put(`/service-categories/${id}`, data).then(normalizeItemResponse),
  remove: (id) =>
    api.delete(`/service-categories/${id}`).then(normalizeItemResponse),
  toggleActive: (id) =>
    api
      .patch(`/service-categories/${id}/toggle-active`)
      .then(normalizeItemResponse),
};

export default serviceCategoryService;
