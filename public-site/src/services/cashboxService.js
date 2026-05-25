import api from "./api";
export const cashboxService = {
  async getBalance() {
    const response = await api.get("/cashbox/balance");
    return response.data;
  },
  async listTransactions(params = {}) {
    const response = await api.get("/cashbox/transactions", { params });
    return response.data;
  },
  async getSummary() {
    const response = await api.get("/dashboard-core/summary");
    return response.data;
  },
  async getLatestTransaction() {
    const res = await api.get("/cashbox/transactions", {
      params: { limit: 1 },
    });
    return res.data;
  },
  // ✅ D3.7: create manual cash transaction
  async createTransaction(payload) {
    const res = await api.post("/cashbox/transactions", payload);
    return res.data;
  },
};

export default cashboxService;
