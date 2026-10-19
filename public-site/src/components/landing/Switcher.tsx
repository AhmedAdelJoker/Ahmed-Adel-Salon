import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/**
 * The listbox behind all three header switchers (appearance, language,
 * currency).
 *
 * These were three near-identical 130-line files that had drifted apart, and
 * between them they carried ~21 hardcoded `#D4AF37` values, a
 * `bg-[#17171A]/95` menu baked for a dark page, and a `surface-glass-strong`
 * class. They now share this one primitive and colour from the palette.
 *
 * ## Accessibility
 *
 * The menu used to close only on a click on a full-screen backdrop, which a
 * keyboard user cannot reach: Escape did nothing and focus walked straight out
 * of the menu into the page behind it. Escape, outside-press and arrow-key
 * roving focus are handled here once.
 */

export interface SwitcherOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export interface SwitcherProps<T extends string> {
  /** Accessible name for the trigger. */
  label: string;
  /** Accessible name for the listbox. */
  listLabel: string;
  options: SwitcherOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Icon shown on the trigger; defaults to the selected option's own. */
  icon?: LucideIcon;
  /** Stable id so `aria-controls` has a target even with several switchers. */
  idPrefix: string;
  className?: string;
}

export default function Switcher<T extends string>({
  label,
  listLabel,
  options,
  value,
  onChange,
  icon,
  idPrefix,
  className = "",
}: SwitcherProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      const items = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
      if (!items || items.length === 0) return;

      event.preventDefault();
      const index = Array.from(items).indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    listRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const selected = options.find((option) => option.id === value) ?? options[0];
  const TriggerIcon = icon ?? selected?.icon;
  const listboxId = `${idPrefix}-listbox`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className="flex items-center gap-1.5 rounded-[length:var(--r-sm)] border border-line px-2.5 py-2 text-[length:var(--step--2)] font-medium text-ink-soft transition-colors duration-200 hover:border-accent-line hover:text-accent"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={value}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className="text-accent"
            aria-hidden="true"
          >
            {TriggerIcon ? <TriggerIcon size={15} /> : null}
          </motion.span>
        </AnimatePresence>
        <span className="hidden sm:inline">{selected?.label}</span>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.ul
            ref={listRef}
            id={listboxId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            aria-label={listLabel}
            aria-orientation="vertical"
            className="absolute end-0 top-full z-50 mt-1.5 min-w-44 overflow-hidden rounded-[length:var(--r-md)] border border-line bg-panel shadow-lg"
          >
            {options.map((option) => {
              const Icon = option.icon;
              const active = option.id === value;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start text-[length:var(--step--1)] transition-colors duration-150 ${
                      active
                        ? "bg-accent-wash text-accent"
                        : "text-ink-soft hover:bg-[color:var(--c-inset)]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {Icon ? (
                        <Icon size={14} aria-hidden="true" className="shrink-0" />
                      ) : null}
                      <span className="truncate">{option.label}</span>
                    </span>
                    {active ? (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
