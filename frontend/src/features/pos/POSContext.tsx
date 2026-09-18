import { createContext, useContext, type ReactNode } from "react";
import { usePOSLogic } from "@/features/pos/hooks/usePOSLogic";
import type { POSContextValue } from "@/features/pos/types";

export const POSContext = createContext<POSContextValue | null>(null);

export const POSProvider = ({ children }: { children: ReactNode }) => {
  const value = usePOSLogic();
  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};

export const usePOS = (): POSContextValue => {
  const context = useContext(POSContext);
  if (!context) throw new Error("usePOS must be used within a POSProvider");
  return context;
};


