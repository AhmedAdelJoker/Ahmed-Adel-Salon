import { useEffect, useRef, useState, useCallback } from "react";
import type * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/core/utils";
import { Search } from "lucide-react";
import { Loader2 } from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  group?: string;
  action: () => void;
  disabled?: boolean;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  loading?: boolean;
}

export function CommandPalette({
  open,
  onClose,
  items,
  placeholder = "ابحث عن أمر... (⌘K)",
  loading = false,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredItems, setFilteredItems] = useState<CommandItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  useEffect(() => {
    const filtered = items
      .filter((item) => {
        if (item.disabled) return false;
        const searchText =
          `${item.label} ${item.shortcut || ""} ${item.group || ""}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      })
      .slice(0, 50);
    setFilteredItems(filtered);
    setSelectedIndex(0);
  }, [items, query]);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredItems.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            filteredItems[selectedIndex].action();
            onClose();
          }
          break;
        case "Tab":
          // Allow tab to move between groups
          break;
        default:
          break;
      }
    },
    [filteredItems, selectedIndex, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = document.querySelector(
      `[data-command-index="${selectedIndex}"]`,
    );
    if (selectedElement && itemsContainerRef.current) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  const groupedItems: Record<string, CommandItem[]> = filteredItems.reduce<Record<string, CommandItem[]>>((acc, item) => {
    const group = item.group || "أوامر";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const content = (
    <div
      className="command-palette-overlay"
      onClick={onClose}
      aria-hidden="true"
    />
  );

  const palette = (
    <div
      className="command-palette"
      role="dialog"
      aria-modal="true"
      aria-label="لوحة الأوامر"
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 icon-size text-n-400"
          aria-hidden="true"
        />
        <input
          ref={searchInputRef}
          type="text"
          className="command-search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          disabled={loading}
          aria-label="البحث عن أمر"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <Loader2
            className="absolute left-4 top-1/2 -translate-y-1/2 icon-size text-accent animate-spin"
            aria-hidden="true"
          />
        )}
      </div>

      {filteredItems.length === 0 && !loading && (
        <div className="px-4 py-8 text-center text-n-500">
          لا توجد أوامر مطابقة
        </div>
      )}

      <div ref={itemsContainerRef} className="flex-1 overflow-hidden">
        {Object.entries(groupedItems).map(([groupLabel, groupItems]) => (
          <div key={groupLabel}>
            <div className="command-group-label">{groupLabel}</div>
            <div className="command-items">
              {groupItems.map((item, index) => {
                const globalIndex = filteredItems.indexOf(item);
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "command-item",
                      isSelected && "data-[selected]",
                      item.disabled && "opacity-50 cursor-not-allowed",
                    )}
                    data-command-index={globalIndex}
                    data-selected={isSelected}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    disabled={item.disabled}
                    role="option"
                    aria-selected={isSelected}
                  >
                    {item.icon && (
                      <span className="command-item-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <span className="flex-1 text-right">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="command-item-shortcut">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-n-200 text-center text-xs text-n-400">
        <kbd className="px-1.5 py-0.5 bg-n-200 rounded-none font-mono">⌘K</kbd>{" "}
        للإغلاق
      </div>
    </div>
  );

  return createPortal([content, palette], document.body);
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CommandItem[]>([]);

  const registerItems = useCallback((newItems: CommandItem[]) => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const unique = newItems.filter((i) => !existingIds.has(i.id));
      return [...prev, ...unique];
    });
  }, []);

  const unregisterItems = useCallback((ids: string[]) => {
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  }, []);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((prev) => !prev), []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePalette]);

  return {
    open,
    items,
    registerItems,
    unregisterItems,
    openPalette,
    closePalette,
    togglePalette,
    CommandPalette: (
      <CommandPalette open={open} onClose={closePalette} items={items} />
    ),
  };
}
