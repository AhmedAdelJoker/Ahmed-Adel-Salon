import api from "@/services/api";
import type { CashboxListParams, CreateCashTransactionPayload, CashboxStats, CashboxBalanceResponse } from "@/types/cashbox";

export const cashboxService = {
  async getBalance(paymentMethod?: string): Promise<CashboxBalanceResponse> {
    const params = paymentMethod && paymentMethod !== "all" ? { payment_method: paymentMethod } : {};
    const res = await api.get("/cashbox/balance", { params });
    return res.data as CashboxBalanceResponse;
  },

  async getSummary(params: { period?: string; from_date?: string; to_date?: string } = {}) {
    const clean: Record<string, string> = {};
    if (params.period && params.period !== "all") clean.period = params.period;
    if (params.from_date) clean.from_date = params.from_date;
    if (params.to_date) clean.to_date = params.to_date;
    try {
      const res = await api.get("/cashbox/summary", { params: clean });
      return res.data;
    } catch {
      const res = await api.get("/dashboard-core/summary");
      return res.data;
    }
  },

  async getStats(params: { period?: string; from_date?: string; to_date?: string } = {}): Promise<CashboxStats> {
    const clean: Record<string, string> = {};
    if (params.period && params.period !== "all") clean.period = params.period;
    if (params.from_date) clean.from_date = params.from_date;
    if (params.to_date) clean.to_date = params.to_date;
    try {
      const res = await api.get("/cashbox/stats", { params: clean });
      return res.data as CashboxStats;
    } catch {
      const summary = await cashboxService.getSummary(params);
      return { summary, trend: [], breakdown: [] };
    }
  },

  async listTransactions(params: CashboxListParams = {}) {
    const res = await api.get("/cashbox/transactions", { params });
    return res.data;
  },

  async getLatestTransaction() {
    const res = await api.get("/cashbox/transactions", { params: { limit: 1 } });
    return res.data;
  },

  async createTransaction(payload: CreateCashTransactionPayload) {
    const res = await api.post("/cashbox/transactions", payload);
    return res.data;
  },

  async downloadReceiptPdf(transactionId: number | string): Promise<Blob> {
    const res = await api.get(`/cashbox/transactions/${transactionId}/pdf`, {
      responseType: "blob",
    });
    return res.data as Blob;
  },
};

export default cashboxService;
