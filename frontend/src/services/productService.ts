import { api } from "@/services/api";

export const productService = {
  list: async () => {
    const response = await api.get("/products");
    return response.data;
  },
  getById: async (productId) => {
    const response = await api.get(`/products/${productId}`);
    return response.data;
  },
  create: async (payload) => {
    const response = await api.post("/products", payload);
    return response.data;
  },
  update: async (productId, payload) => {
    const response = await api.put(`/products/${productId}`, payload);
    return response.data;
  },
  addStock: async (productId, payload) => {
    const response = await api.post(
      `/products/${productId}/add-stock`,
      payload,
    );
    return response.data;
  },
  removeStock: async (productId, payload) => {
    const response = await api.post(
      `/products/${productId}/remove-stock`,
      payload,
    );
    return response.data;
  },
  adjustStock: async (productId, payload) => {
    const response = await api.post(
      `/products/${productId}/adjust-stock`,
      payload,
    );
    return response.data;
  },
  logs: async (productId) => {
    const response = await api.get(`/products/${productId}/logs`);
    return response.data;
  },
};
