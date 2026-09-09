import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";

/**
 * ThemeToggle — Light/Dark/System mode switcher.
 * - 3 modes: light, dark, system (auto)
 * - Persists in localStorage
 * - Smooth icon transitions with Framer Motion
 * - Respects OS preference on first visit
 */
const STORAGE_KEY = "salon-theme";
const MODES = [
  { id: "light", icon: Sun, label: "فاتح" },
  { id: "dark", icon: Moon, label: "داكن" },
  { id: "system", icon: Monitor, label: "تلقائي" },
];

function getSystemMode() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode) {
  if (typeof document === "undefined") return;
  const effective = mode === "system" ? getSystemMode() : mode;
  const root = document.documentElement;
  if (effective === "dark") {
    root.classList.add("dark");
    root.dataset.theme = "dark";
  } else {
    root.classList.remove("dark");
    root.dataset.theme = "light";
  }
}

export default function ThemeToggle({ className = "" }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "system";
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch {
      return "system";
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    applyTheme(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }

    // Listen to system theme changes when in "system" mode
    if (mode === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }
  }, [mode]);

  const current = MODES.find((m) => m.id === mode) || MODES[2];
  const CurrentIcon = current.icon;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="تبديل المظهر"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 hover:bg-white/10 transition-all text-xs font-black"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.25 }}
            className="text-[#D4AF37]"
          >
            <CurrentIcon size={14} />
          </motion.span>
        </AnimatePresence>
        <span className="hidden sm:inline text-white">{current.label}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close on outside click */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <motion.ul
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              role="listbox"
              aria-label="اختر المظهر"
              className="absolute end-0 top-full mt-2 min-w-[140px] z-50 rounded-2xl border border-white/10 surface-glass-strong overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
            >
              {MODES.map((m) => {
                const Icon = m.icon;
                const active = m.id === mode;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setMode(m.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-bold transition-colors ${
                        active
                          ? "text-[#D4AF37] bg-[#D4AF37]/10"
                          : "text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          size={14}
                          className={active ? "text-[#D4AF37]" : "text-slate-400"}
                        />
                        <span>{m.label}</span>
                      </span>
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />
                      )}
                    </button>
                  </li>
                );
              })}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
