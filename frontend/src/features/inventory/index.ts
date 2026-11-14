// Inventory Feature Components - Barrel Export
export { useInventoryData } from "@/features/inventory/hooks/useInventoryData";
export type { InventoryProduct, InventoryStats } from "@/features/inventory/hooks/useInventoryData";
export { useInventoryForm } from "@/features/inventory/hooks/useInventoryForm";
export type { ProductFormData, StockFormData } from "@/features/inventory/hooks/useInventoryForm";
export { useInventoryInsights } from "@/features/inventory/hooks/useInventoryInsights";
export * from "@/features/inventory/insights";
export { StockBar } from "@/features/inventory/components/StockBar";
export { InventoryHero } from "@/features/inventory/components/InventoryHero";
export { InsightsPanel } from "@/features/inventory/components/InsightsPanel";
export { CategoryChips } from "@/features/inventory/components/CategoryChips";
export { InventoryCard } from "@/features/inventory/components/InventoryCard";
export { InventoryTable } from "@/features/inventory/components/InventoryTable";
export { BulkActionBar } from "@/features/inventory/components/BulkActionBar";
export {
  ProductCard,
  SmartStatusBar,
  StatusBadge,
  Metric,
  CategoryIcon,
} from "@/features/inventory/components/ProductCard";
export {
  ProductCardSkeleton,
  StatCardSkeleton,
  StatsGridSkeleton,
  ToolbarSkeleton,
  FilterPanelSkeleton,
} from "@/features/inventory/components/Skeletons";
export { StockWizard } from "@/features/inventory/components/StockWizard";
export { FilterPanel } from "@/features/inventory/components/FilterPanel";
export { FormField } from "@/features/inventory/components/FormField";
export type { FormFieldProps } from "@/features/inventory/components/FormField";
export { ProductFormModal } from "@/features/inventory/components/ProductFormModal";
export type { ProductFormModalProps } from "@/features/inventory/components/ProductFormModal";
export { StockSupplyModal } from "@/features/inventory/components/StockSupplyModal";
export type { StockSupplyModalProps } from "@/features/inventory/components/StockSupplyModal";
export { HistoryModal } from "@/features/inventory/components/HistoryModal";
export type { HistoryModalProps } from "@/features/inventory/components/HistoryModal";
export { ProductDetailsModal } from "@/features/inventory/components/ProductDetailsModal";
export type { ProductDetailsModalProps } from "@/features/inventory/components/ProductDetailsModal";
export {
  default as designTokens,
  inventoryTokens,
  getProductStatusToken,
  getProductStatusLabel,
  getCategoryTone,
  getUnitMeta,
  getAvailablePacks,
  getEstimatedUnitCost,
  getEstimatedUnitPrice,
  formatQuantity,
  UNIT_OPTIONS,
  normalizeUnit,
  DEFAULT_FORM,
  DEFAULT_STOCK_FORM,
  cssVars,
} from "@/features/inventory/design-tokens";
