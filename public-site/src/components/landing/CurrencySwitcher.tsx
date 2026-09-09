import { useState, useRef, useEffect } from "react";
import { Coins, Check, ChevronDown } from "lucide-react";
import { useCurrency } from "../../context/CurrencyContext";

/**
 * CurrencySwitcher — Dropdown to switch between EGP/USD/EUR/SAR/AED.
 * Persists in localStorage via CurrencyContext.
 */
export interface CurrencySwitcherProps {
  className?: string;
}

export default function CurrencySwitcher({ className = "" }: CurrencySwitcherProps) {
  const { currency, setCurrency, availableCurrencies } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [isOpen]);

  const current = availableCurrencies.find((c) => c.code === currency);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Switch currency"
        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 hover:bg-white/10 transition-all text-xs font-black tracking-wider"
      >
        <Coins size={14} className="text-[#D4AF37]" />
        <span className="hidden sm:inline text-white">{current?.code}</span>
        <span className="text-[#D4AF37]">{current?.symbol}</span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select currency"
          className="absolute top-full mt-2 end-0 min-w-[180px] rounded-2xl border border-white/10 bg-[#17171A]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-50"
        >
          {availableCurrencies.map((curr) => (
            <li key={curr.code}>
              <button
                type="button"
                role="option"
                aria-selected={curr.code === currency}
                onClick={() => {
                  setCurrency(curr.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold hover:bg-white/5 transition-colors ${
                  curr.code === currency ? "text-[#D4AF37]" : "text-slate-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base text-[#D4AF37]">{curr.symbol}</span>
                  <span className="text-xs font-black tracking-wider">{curr.code}</span>
                  <span className="text-xs opacity-60">— {curr.label}</span>
                </span>
                {curr.code === currency && <Check size={14} className="text-[#D4AF37]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
