import { api } from "./api";
import { normalizeListResponse, normalizeItemResponse } from "./apiAdapter";

export const posShiftService = {
  list: async (params = {}) => {
    const response = await api.get("/pos-shifts", { params });
    return normalizeListResponse(response);
  },

  current: async () => {
    const response = await api.get("/pos-shifts/current");
    return normalizeItemResponse(response, null);
  },

  open: async (payload = {}) => {
    const response = await api.post("/pos-shifts/open", {
      opening_cash: Number(payload.opening_cash ?? payload.openingCash ?? 0),
      opening_note: payload.opening_note ?? payload.openingNote ?? "",
    });
    return normalizeItemResponse(response, null);
  },

  close: async (shiftId, payload = {}) => {
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
};

export default posShiftService;
