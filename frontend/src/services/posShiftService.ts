import { api } from "@/services/api";
import { normalizeListResponse, normalizeItemResponse } from "@/services/apiAdapter";

export const posShiftService = {
  list: async (params: Record<string, unknown> = {}) => {
    const response = await api.get("/pos-shifts", { params });
    return normalizeListResponse(response);
  },

  current: async () => {
    const response = await api.get("/pos-shifts/current");
    return normalizeItemResponse(response, null);
  },

  // Live money-grade aggregates for the open shift (GET /pos-shifts/current/stats).
  // Returns the flat stats object (total_sales, invoice_count, expected_closing_cash, ...)
  // or null when no shift is open. Mirrors close_shift arithmetic:
  // expected_closing_cash = opening + cash sales - cash expenses.
  currentStats: async () => {
    const response = await api.get("/pos-shifts/current/stats");
    return response.data?.stats ?? null;
  },

  open: async (payload: Record<string, unknown> = {}) => {
    const response = await api.post("/pos-shifts/open", {
      opening_cash: Number(payload.opening_cash ?? payload.openingCash ?? 0),
      opening_note: payload.opening_note ?? payload.openingNote ?? "",
    });
    return normalizeItemResponse(response, null);
  },

  close: async (shiftId: string | number, payload: Record<string, unknown> = {}) => {
    if (!shiftId) {
      throw new Error("shiftId is required to close POS shift");
    }

    const closingValue = Number(
      payload.countedCash ??
        payload.counted_cash ??
        payload.closing_cash ??
        payload.closingCash ??
        payload.actual_cash ??
        payload.actualCash ??
        payload.cash_counted ??
        payload.cashCounted ??
        0,
    );

    const closingNote = payload.closing_note ?? payload.closingNote ?? "";

    const response = await api.post(`/pos-shifts/${shiftId}/close`, {
      countedCash: closingValue,
      closing_note: closingNote,
      closingNote,
      // Manager co-signature fields for the high-variance close policy — the
      // backend only requires them for non-supervisory closers over the limit.
      approver_username: payload.approver_username ?? payload.approverUsername ?? "",
      approver_password: payload.approver_password ?? payload.approverPassword ?? "",
    });

    return normalizeItemResponse(response, null);
  },

  // Money-grade figures for any (usually closed) shift — powers the reprint
  // of an archived shift report.
  shiftStats: async (shiftId: string | number) => {
    const response = await api.get(`/pos-shifts/${shiftId}/stats`);
    return response.data?.stats ?? null;
  },

  getBalance: async () => {
    const response = await api.get("/pos-shifts/total-balance");
    return response.data?.total_balance ?? response.data ?? 0;
  },

  // Aliases kept for backward compatibility with older call sites
  openShift: async (payload: Record<string, unknown> = {}) => {
    return posShiftService.open(payload);
  },
  startShift: async (payload: Record<string, unknown> = {}) => {
    return posShiftService.open(payload);
  },
  create: async (payload: Record<string, unknown> = {}) => {
    return posShiftService.open(payload);
  },
  closeShift: async (shiftId: string | number, payload: Record<string, unknown> = {}) => {
    return posShiftService.close(shiftId, payload);
  },
  endShift: async (shiftId: string | number, payload: Record<string, unknown> = {}) => {
    return posShiftService.close(shiftId, payload);
  },
  update: async (shiftId: string | number, payload: Record<string, unknown> = {}) => {
    return posShiftService.close(shiftId, payload);
  },
};

export default posShiftService;
