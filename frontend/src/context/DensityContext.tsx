import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type Density = "comfortable" | "compact";

export interface DensityContextValue {
  density: Density;
  toggleDensity: () => void;
  setDensity: (newDensity: Density) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

const STORAGE_KEY = "bl-os:density";

function readInitialDensity(): Density {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "comfortable" || stored === "compact") return stored;
    // Respect user's system preference for reduced motion as a hint for compact
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return "compact";
    }
  }
  return "comfortable";
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>(readInitialDensity);

  const setDensity = useCallback((newDensity: Density) => {
    setDensityState(newDensity);
    localStorage.setItem(STORAGE_KEY, newDensity);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === "comfortable" ? "compact" : "comfortable");
  }, [density, setDensity]);

  // Apply density to document element for CSS variable access
  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && density === "comfortable") {
        // Auto-switch to compact on reduced motion preference
        setDensity("compact");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [density, setDensity]);

  return (
    <DensityContext.Provider value={{ density, toggleDensity, setDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);
  if (!context) {
    throw new Error("useDensity must be used within a DensityProvider");
  }
  return context;
}
