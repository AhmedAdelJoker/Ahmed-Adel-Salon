import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useI18n, type LocaleCode } from "../../context/I18nContext";

/**
 * LanguageSwitcher — Dropdown to switch between AR / EN.
 * Persists in localStorage via I18nContext.
 * Updates <html lang/dir> automatically.
 */
export interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale, availableLocales } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const current = availableLocales.find((l) => l.code === locale);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Switch language"
        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 hover:bg-white/10 transition-all text-xs font-black tracking-wider"
      >
        <Globe size={14} className="text-[#D4AF37]" />
        <span aria-hidden="true">{current?.flag}</span>
        <span className="hidden sm:inline text-white">{current?.code.toUpperCase()}</span>
        <ChevronDown
          size={12}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute top-full mt-2 end-0 min-w-[140px] rounded-2xl border border-white/10 bg-[#17171A]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-50"
        >
          {availableLocales.map((loc) => (
            <li key={loc.code}>
              <button
                type="button"
                role="option"
                aria-selected={loc.code === locale}
                onClick={() => {
                  setLocale(loc.code as LocaleCode);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold hover:bg-white/5 transition-colors ${
                  loc.code === locale ? "text-[#D4AF37]" : "text-slate-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{loc.flag}</span>
                  <span>{loc.label}</span>
                </span>
                {loc.code === locale && <Check size={14} className="text-[#D4AF37]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
