import api from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

const salaryAdvanceService = {
  list: (params) => api.get("/salary-advances", { params }).then(normalizeListResponse),
  create: (payload) =>
    api.post("/salary-advances", payload).then(normalizeItemResponse),
  remove: (id) => api.delete(`/salary-advances/${id}`).then(normalizeItemResponse),
};

export default salaryAdvanceService;
