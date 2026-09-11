/**
 * Catalog pricing math (moved from ServicesManagement page, no logic changes).
 * Pure functions: callers pass the product index explicitly.
 */
import type { ProductRecord } from "@/types/catalog";

export interface CatalogSummary {
  total: number;
  active: number;
  categories: number;
  averageMargin: number;
  lowStock: number;
}

export interface PricingApi {
  getIngredientProduct: (ingredient: any) => any;
  getProductGramCost: (product: any) => number;
  getIngredientCost: (ingredient: any) => number;
  getServiceOperationalCost: (service: any) => number;
  getServiceProfit: (service: any) => number;
  getServiceMargin: (service: any) => number;
  getServiceLowStockCount: (service: any) => number;
}

export const getProductGramCost = (product) => {
  const weight = Number(product?.weight || 0);
  const costPrice = Number(product?.cost_price || 0);

  if (weight > 0) return costPrice / weight;
  if ((product?.unit || "g").toLowerCase() === "g") return costPrice;
  return 0;
};

export const getIngredientProduct = (
  productIndex: Map<number, ProductRecord>,
  ingredient,
) => {
  const productId = Number(ingredient?.product_id);
  if (productIndex.has(productId)) {
    return productIndex.get(productId);
  }

  return {
    id: ingredient?.product_id,
    name: ingredient?.product_name,
    unit: ingredient?.product_unit || "g",
    quantity: ingredient?.product_quantity || 0,
    cost_price: ingredient?.product_cost_price || 0,
    weight: ingredient?.product_weight || 0,
  };
};

export const getIngredientCost = (
  productIndex: Map<number, ProductRecord>,
  ingredient,
) => {
  const amountUsed = Number(ingredient?.amount_used || 0);
  const product = getIngredientProduct(productIndex, ingredient);
  return amountUsed * getProductGramCost(product);
};

export const getServiceOperationalCost = (
  productIndex: Map<number, ProductRecord>,
  service,
) =>
  (service?.ingredients || []).reduce(
    (sum, ingredient) => sum + getIngredientCost(productIndex, ingredient),
    0,
  );

export const getServiceProfit = (
  productIndex: Map<number, ProductRecord>,
  service,
) =>
  Number(service?.price || 0) -
  getServiceOperationalCost(productIndex, service);

export const getServiceMargin = (
  productIndex: Map<number, ProductRecord>,
  service,
) => {
  const price = Number(service?.price || 0);
  if (price <= 0) return 0;
  return (getServiceProfit(productIndex, service) / price) * 100;
};

export const getServiceLowStockCount = (
  productIndex: Map<number, ProductRecord>,
  service,
) =>
  (service?.ingredients || []).filter((ingredient) => {
    const product = getIngredientProduct(productIndex, ingredient);
    return (
      Number(product?.quantity || 0) < Number(ingredient?.amount_used || 0)
    );
  }).length;
