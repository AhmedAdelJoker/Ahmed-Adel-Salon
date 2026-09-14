import api from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

const salaryAdvanceService = {
  list: (params) =>
    api.get("/salary-advances", { params }).then(normalizeListResponse),
  create: (payload) =>
    api.post("/salary-advances", payload).then(normalizeItemResponse),
  remove: (id) =>
    api.delete(`/salary-advances/${id}`).then(normalizeItemResponse),
};

export default salaryAdvanceService;
