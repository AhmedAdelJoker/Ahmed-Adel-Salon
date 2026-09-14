import api from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

const employeeDocumentService = {
  list: (employeeId) =>
    api.get(`/employees/${employeeId}/documents`).then(normalizeListResponse),

  upload: (employeeId, formData) =>
    api
      .post(`/employees/${employeeId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(normalizeItemResponse),

  remove: (documentId) =>
    api
      .delete(`/employees/documents/${documentId}`)
      .then(normalizeItemResponse),

  getExpiring: (days = 15) =>
    api
      .get("/employees/expiring", { params: { days } })
      .then(normalizeListResponse),
};

export default employeeDocumentService;
