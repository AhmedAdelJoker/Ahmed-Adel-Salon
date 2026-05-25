import { api } from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

export const invoiceService = {
  list: async (params = { page: 1, page_size: 20 }) => {
    const response = await api.get("/invoices", { params });
    return normalizeListResponse(response);
  },

  createManual: async (payload) => {
    const response = await api.post("/invoices/manual", payload);
    return normalizeItemResponse(response);
  },

  getById: async (invoiceId) => {
    const response = await api.get(`/invoices/${invoiceId}`);
    return normalizeItemResponse(response);
  },

  update: async (invoiceId, payload) => {
    const response = await api.patch(`/invoices/${invoiceId}`, payload);
    return normalizeItemResponse(response);
  },

  getPdfUrl: (invoiceId, inline = false) => {
    return `/api/v1/invoices/${invoiceId}/pdf${inline ? "?inline=true" : ""}`;
  },

  downloadPdf: async (invoiceId) => {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, {
      responseType: "blob",
    });
    return response.data; // Blob should not be normalized
  },

  sendWhatsappPdf: async (invoiceId) => {
    const response = await api.post(`/invoices/${invoiceId}/send-whatsapp-pdf`);
    return normalizeItemResponse(response);
  },

  createDiscountRequest: async (payload) => {
    const response = await api.post("/discount-approvals", payload);
    return normalizeItemResponse(response);
  },

  issueFromAppointment: async (
    appointmentId,
    paymentMethod = "cash",
    payload = null,
  ) => {
    const response = await api.post(
      `/appointments/${appointmentId}/issue-invoice`,
      payload,
      {
        params: { payment_method: paymentMethod },
      },
    );
    return normalizeItemResponse(response);
  },
};
