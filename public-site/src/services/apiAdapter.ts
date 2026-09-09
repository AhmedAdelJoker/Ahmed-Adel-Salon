/**
 * API Response Adapter
 * يوحّد شكل ردود الـ API في مكان واحد لضمان استقرار الواجهة الأمامية.
 */
export const unwrapResponse = (response) => {
  if (response && typeof response === "object") {
    if ("data" in response && response.data !== null) return response.data;
    return response;
  }

  return response ?? null;
};

export const normalizeListResponse = (response) => {
  const raw = unwrapResponse(response);

  if (!raw) {
    return { items: [], total: 0 };
  }

  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length };
  }

  if (typeof raw === "object") {
    const listKeys = [
      "items",
      "data",
      "results",
      "rows",
      "records",
      "list",
      "chart_data",
    ];
    const listKey = listKeys.find((key) => Array.isArray(raw[key]));

    if (listKey) {
      const items = raw[listKey];
      const total =
        Number(raw.total ?? raw.count ?? raw.total_count ?? items.length) ||
        items.length;
      return { items, total };
    }

    return { items: [], total: Number(raw.total ?? raw.count ?? 0) || 0 };
  }

  return { items: [], total: 0 };
};

export const normalizeItemResponse = (response, fallback = null) => {
  const raw = unwrapResponse(response);

  if (!raw) return fallback;

  if (Array.isArray(raw)) return raw[0] ?? fallback;

  if (typeof raw !== "object") return fallback;

  if (Array.isArray(raw.items)) return raw.items[0] ?? fallback;
  if (Array.isArray(raw.data)) return raw.data[0] ?? fallback;
  if (raw.item && typeof raw.item === "object") return raw.item;
  if (raw.record && typeof raw.record === "object") return raw.record;
  if (raw.result && typeof raw.result === "object") return raw.result;

  return raw;
};

export const adaptApiResponse = (res) => {
  const normalized = normalizeListResponse(res);
  return {
    ...normalized,
    raw: unwrapResponse(res),
  };
};

export const adaptList = (res) => normalizeListResponse(res).items;
export const adaptTotal = (res) => normalizeListResponse(res).total;
export const adaptItem = normalizeItemResponse;
export const adaptObject = normalizeItemResponse;
