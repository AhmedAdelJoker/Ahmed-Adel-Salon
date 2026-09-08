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
    });

    return normalizeItemResponse(response, null);
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
