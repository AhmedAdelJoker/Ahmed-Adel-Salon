/**
 * POS feature barrel.
 * Re-exports types, hook logic and context provider.
 */
export * from "@/features/pos/types";
export { usePOSLogic, usePOSData } from "@/features/pos/hooks/usePOSLogic";
export { POSContext, POSProvider, usePOS } from "@/features/pos/POSContext";
