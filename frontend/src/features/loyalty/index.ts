export * from "@/features/loyalty/utils/loyaltyHelpers";
export * from "@/features/loyalty/hooks/useLoyaltySettings";

// Re-exported so consumers use the feature's public API instead of
// reaching into its internals. See eslint.config.js -> featureBoundary.
export { PreviewCard } from "@/features/loyalty/components/PreviewCard";
export { TierRow } from "@/features/loyalty/components/TierRow";
