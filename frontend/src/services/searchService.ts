import { api } from "@/services/api";

export const searchService = {
  universalSearch: async (q) => {
    if (!q || q.length < 1) return [];
    try {
      const response = await api.get("/search/universal", { params: { q } });
      return response.data || [];
    } catch (_error) {
      console.error("Universal Search Error:", _error);
      return [];
    }
  },
};
