/**
 * Thin shim re-exporting POS feature.
 * Original logic moved to @/features/pos — keep this file for import-path compatibility.
 * Many files import from "@/pages/cashier/POS/POSContext" (7 usages); shim preserves paths.
 */
export * from "@/features/pos";
export { POSProvider as default } from "@/features/pos";
