/**
 * Shared components barrel — Phase 1 UI unification.
 *
 * Canonical async states (Loading / Error / Empty) are exported from
 * AsyncState.tsx with role=status/alert + aria-live semantics.
 * Import via `@/components/shared` to avoid relative paths.
 */
export { LoadingState, ErrorState, EmptyState } from "@/components/shared/AsyncState";
export { default as PremiumUI } from "@/components/shared/PremiumUI";
