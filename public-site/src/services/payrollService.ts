import api from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

const payrollService = {
  list: (params) => api.get("/payroll", { params }).then(normalizeListResponse),
  summary: (params) =>
    api.get("/payroll/summary", { params }).then(normalizeItemResponse),
  archive: (params) =>
    api.get("/payroll/archive", { params }).then(normalizeListResponse),
  calculate: (payload) =>
    api.post("/payroll/calculate", payload).then(normalizeItemResponse),
  create: (payload) =>
    api.post("/payroll", payload).then(normalizeItemResponse),
  update: (id, payload) =>
    api.put(`/payroll/${id}`, payload).then(normalizeItemResponse),
  remove: (id) => api.delete(`/payroll/${id}`).then(normalizeItemResponse),
  pay: (id, payload) =>
    api.post(`/payroll/${id}/pay`, payload).then(normalizeItemResponse),
  cancel: (id) => api.post(`/payroll/${id}/cancel`).then(normalizeItemResponse),
};

export default payrollService;
