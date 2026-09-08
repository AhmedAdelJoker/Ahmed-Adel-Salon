import { createContext, useContext, useState, type ReactNode } from "react";
import { EmployeeQuickView } from "@/components/shared/EmployeeQuickView";
import type { ID } from "@/types/common";

export interface UIContextValue {
  openEmployeeQuickView: (id: ID) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [quickViewId, setQuickViewId] = useState<ID | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const openEmployeeQuickView = (id: ID) => {
    setQuickViewId(id);
    setIsQuickViewOpen(true);
  };

  return (
    <UIContext.Provider value={{ openEmployeeQuickView }}>
      {children}
      <EmployeeQuickView
        employeeId={quickViewId}
        open={isQuickViewOpen}
        onOpenChange={setIsQuickViewOpen}
      />
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};
