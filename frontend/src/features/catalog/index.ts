/**
 * Catalog feature barrel.
 */
export {
  TABS,
  DEFAULT_SERVICE_FORM,
  DEFAULT_CATEGORY_FORM,
  DEFAULT_OFFER_FORM,
} from "@/features/catalog/constants";
export { isItemActive } from "@/features/catalog/constants";
export {
  getIngredientCost,
  getIngredientProduct,
  getProductGramCost,
  getServiceLowStockCount,
  getServiceMargin,
  getServiceOperationalCost,
  getServiceProfit,
} from "@/features/catalog/utils/pricing";
export type { CatalogSummary, PricingApi } from "@/features/catalog/utils/pricing";
export { useCatalogData } from "@/features/catalog/hooks/useCatalogData";
export { useCatalogForms } from "@/features/catalog/hooks/useCatalogForms";
export { default as CatalogHeader } from "@/features/catalog/components/CatalogHeader";
export { default as ServicesPanel } from "@/features/catalog/components/ServicesPanel";
export { default as CategoriesPanel } from "@/features/catalog/components/CategoriesPanel";
export { default as OffersPanel } from "@/features/catalog/components/OffersPanel";
export { default as ServiceFormModal } from "@/features/catalog/components/ServiceFormModal";
export { default as CategoryFormModal } from "@/features/catalog/components/CategoryFormModal";
export { default as OfferFormModal } from "@/features/catalog/components/OfferFormModal";
