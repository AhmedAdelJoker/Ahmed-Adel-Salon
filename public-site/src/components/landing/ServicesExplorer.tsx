import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Grid3x3,
  List,
  ChevronDown,
  Clock3,
  Star,
  Sparkles,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Loader2,
  AlertCircle,
  CalendarCheck2,
  Inbox,
} from "lucide-react";
import { Button } from "../ui/button";
import { buildSrcSet, buildSizes } from "../../lib/imageOptimizer";
import { trackEvent } from "./Analytics";
import type { ID } from "../../types/common";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServiceRecord = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CategoryRecord = Record<string, any>;

export interface LandingThemeTokens {
  primary?: string;
  dark?: string;
  text?: string;
  card?: string;
  muted?: string;
  focus?: string;
  [key: string]: string | undefined;
}

export interface ServicesExplorerProps {
  services?: ServiceRecord[];
  categories?: CategoryRecord[];
  theme?: LandingThemeTokens;
  currency?: string;
  onBookService?: (service: ServiceRecord | null) => void;
  bookmarkedIds?: ID[];
  onToggleBookmark?: ((id: ID) => void) | null;
}

/**
 * ServicesExplorer — World-class, fully responsive, isolated services browser.
 *
 * Features:
 * - Debounced text search (AR + EN)
 * - Category pills with smooth indicator
 * - Price range (min/max) with derived bounds
 * - Duration filter (short/medium/long)
 * - Sort: recommended / price asc / price desc / duration / popularity / name
 * - View mode toggle (grid 2-4 cols / list)
 * - Responsive: 1 col mobile → 2 tablet → 3 desktop → 4 xl
 * - Stable keys (prevents data overlap)
 * - Localized state (doesn't conflict with parent)
 * - Loading / error / empty states
 * - A11y: ARIA labels, keyboard nav, focus management
 */
export default function ServicesExplorer({
  services = [],
  categories = [],
  theme = {},
  currency = "ج.م",
  onBookService,
  bookmarkedIds = [],
  onToggleBookmark,
}: ServicesExplorerProps) {
  // ───── Local state (isolated from parent) ─────
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: Infinity });
  const [durationFilter, setDurationFilter] = useState("all"); // all | short | medium | long
  const [sortBy, setSortBy] = useState("recommended"); // recommended | price_asc | price_desc | duration_asc | popularity | name
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading] = useState(false); // hook for future async
  const [error] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ───── Debounced search ─────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // ───── Derived: price bounds from data ─────
  const priceBounds = useMemo(() => {
    if (services.length === 0) return { min: 0, max: 0 };
    const prices = services
      .map((s) => Number(s.price) || 0)
      .filter((p) => p > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [services]);

  // Reset price range when bounds change
  useEffect(() => {
    setPriceRange({ min: priceBounds.min, max: priceBounds.max });
  }, [priceBounds.min, priceBounds.max]);

  // ───── Derived: categories with counts ─────
  const categoriesWithCounts: CategoryRecord[] = useMemo(() => {
    const map = new Map<string | number, number>();
    services.forEach((s) => {
      const key = (s.category_id ?? "uncategorized") as string | number;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return categories.map((c): CategoryRecord => ({
      ...c,
      count: map.get(c.id as string | number) || 0,
    }));
  }, [services, categories]);

  // ───── Derived: filtered + sorted services ─────
  const filteredServices = useMemo(() => {
    let result = services;

    // 1. Text search
    if (debouncedQuery) {
      const tokens = debouncedQuery.split(/\s+/).filter(Boolean);
      result = result.filter((s) => {
        const haystack = [
          s.name_ar,
          s.name,
          s.description_ar,
          s.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
    }

    // 2. Category
    if (activeCategory !== "all") {
      result = result.filter(
        (s) => String(s.category_id) === String(activeCategory),
      );
    }

    // 3. Price range
    result = result.filter((s) => {
      const p = Number(s.price) || 0;
      return p >= priceRange.min && p <= priceRange.max;
    });

    // 4. Duration
    if (durationFilter !== "all") {
      result = result.filter((s) => {
        const d = Number(s.duration_minutes || s.duration) || 0;
        if (durationFilter === "short") return d <= 30;
        if (durationFilter === "medium") return d > 30 && d <= 60;
        if (durationFilter === "long") return d > 60;
        return true;
      });
    }

    // 5. Sort
    const sorted = [...result];
    switch (sortBy) {
      case "price_asc":
        sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
        break;
      case "price_desc":
        sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
        break;
      case "duration_asc":
        sorted.sort(
          (a, b) =>
            (Number(a.duration_minutes || a.duration) || 0) -
            (Number(b.duration_minutes || b.duration) || 0),
        );
        break;
      case "popularity":
        sorted.sort(
          (a, b) =>
            (Number(b.popularity || b.bookings_count) || 0) -
            (Number(a.popularity || a.bookings_count) || 0),
        );
        break;
      case "name":
        sorted.sort((a, b) =>
          (a.name_ar || a.name || "").localeCompare(b.name_ar || b.name || "", "ar"),
        );
        break;
      case "recommended":
      default:
        sorted.sort((a, b) => {
          const af = a.is_featured ? 1 : 0;
          const bf = b.is_featured ? 1 : 0;
          if (af !== bf) return bf - af;
          return (Number(b.popularity) || 0) - (Number(a.popularity) || 0);
        });
    }

    return sorted;
  }, [services, debouncedQuery, activeCategory, priceRange, durationFilter, sortBy]);

  // ───── Handlers ─────
  const clearFilters = useCallback(() => {
    setQuery("");
    setActiveCategory("all");
    setPriceRange({ min: priceBounds.min, max: priceBounds.max });
    setDurationFilter("all");
    setSortBy("recommended");
  }, [priceBounds]);

  const hasActiveFilters =
    debouncedQuery ||
    activeCategory !== "all" ||
    durationFilter !== "all" ||
    priceRange.min > priceBounds.min ||
    priceRange.max < priceBounds.max;

  const handleBook = useCallback(
    (svc: ServiceRecord) => {
      trackEvent("service_book_click", {
        serviceId: svc.id,
        serviceName: svc.name_ar || svc.name,
      });
      if (onBookService) onBookService(svc);
    },
    [onBookService],
  );

  // ───── Render ─────
  return (
    <div className="space-y-8">
      {/* Header row: title + booking CTA */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p
            className="text-[10px] font-black uppercase tracking-[0.4em] mb-2"
            style={{ color: theme.primary }}
          >
            Master Crafted Services
          </p>
          <h2
            className="text-3xl md:text-5xl font-black tracking-tight"
            style={{ color: theme.dark }}
          >
            خدماتنا الاحترافية
          </h2>
          <p
            className="text-sm md:text-base font-bold opacity-60 mt-2 max-w-xl"
            style={{ color: theme.text }}
          >
            اختر خدمتك المفضلة من {services.length} خدمة احترافية
          </p>
        </div>
        <Button
          onClick={() => onBookService?.(null)}
          className="hidden md:flex h-12 px-6 rounded-2xl font-black border-none items-center gap-2"
          style={{
            backgroundColor: theme.dark,
            color: theme.primary,
          }}
        >
          <CalendarCheck2 size={16} />
          احجز الآن
        </Button>
      </div>

      {/* Search + controls bar */}
      <div className="sticky top-20 z-30 -mx-6 px-6 py-3 bg-[var(--bg,#09090B)]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-0">
            <Search
              size={18}
              className="absolute top-1/2 -translate-y-1/2 start-4 text-slate-500"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن خدمة... (مثل: قص، لحية، بشرة)"
              aria-label="ابحث في الخدمات"
              className="w-full h-12 ps-12 pe-12 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:border-[#D4AF37]/40 focus:outline-none transition-colors placeholder:text-slate-500"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="مسح البحث"
                className="absolute top-1/2 -translate-y-1/2 end-3 h-7 w-7 rounded-lg flex items-center justify-center bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="ترتيب حسب"
                className="h-12 ps-10 pe-8 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:border-[#D4AF37]/40"
              >
                <option value="recommended" className="bg-[#17171A]">
                  ✨ موصى به
                </option>
                <option value="popularity" className="bg-[#17171A]">
                  🔥 الأكثر طلباً
                </option>
                <option value="price_asc" className="bg-[#17171A]">
                  💰 السعر: الأقل
                </option>
                <option value="price_desc" className="bg-[#17171A]">
                  💎 السعر: الأعلى
                </option>
                <option value="duration_asc" className="bg-[#17171A]">
                  ⏱️ الأسرع
                </option>
                <option value="name" className="bg-[#17171A]">
                  🔤 أبجدياً
                </option>
              </select>
              <ArrowUpDown
                size={14}
                className="absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 pointer-events-none"
              />
            </div>

            {/* Filters toggle */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-pressed={showFilters}
              aria-label="إظهار/إخفاء الفلاتر"
              className={`h-12 px-4 rounded-2xl border text-xs font-black flex items-center gap-2 transition-all ${
                showFilters || hasActiveFilters
                  ? "bg-[#D4AF37] text-[#09090B] border-[#D4AF37]"
                  : "bg-white/5 border-white/10 text-white hover:bg-white/10"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">فلاتر</span>
              {hasActiveFilters && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                  {/* count of active filters */}
                  {(debouncedQuery ? 1 : 0) +
                    (activeCategory !== "all" ? 1 : 0) +
                    (durationFilter !== "all" ? 1 : 0) +
                    (priceRange.min > priceBounds.min || priceRange.max < priceBounds.max
                      ? 1
                      : 0)}
                </span>
              )}
            </button>

            {/* View mode */}
            <div
              className="hidden sm:flex h-12 rounded-2xl border border-white/10 bg-white/5 p-1 gap-1"
              role="group"
              aria-label="وضع العرض"
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                aria-label="عرض شبكي"
                className={`h-9 w-10 rounded-xl flex items-center justify-center transition-all ${
                  viewMode === "grid"
                    ? "bg-[#D4AF37] text-[#09090B]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Grid3x3 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                aria-label="عرض قائمة"
                className={`h-9 w-10 rounded-xl flex items-center justify-center transition-all ${
                  viewMode === "list"
                    ? "bg-[#D4AF37] text-[#09090B]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Filter panel (collapsible) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {/* Price range */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-[#D4AF37]" />
                      نطاق السعر
                    </span>
                    <span className="text-[10px] font-black text-[#D4AF37]">
                      {priceRange.min} - {Number.isFinite(priceRange.max) ? priceRange.max : "∞"} {currency}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={priceRange.min}
                      onChange={(e) =>
                        setPriceRange((p) => ({
                          ...p,
                          min: Number(e.target.value) || 0,
                        }))
                      }
                      placeholder="من"
                      className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#D4AF37]/40"
                    />
                    <input
                      type="number"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={Number.isFinite(priceRange.max) ? priceRange.max : ""}
                      onChange={(e) =>
                        setPriceRange((p) => ({
                          ...p,
                          max: Number(e.target.value) || Infinity,
                        }))
                      }
                      placeholder="إلى"
                      className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#D4AF37]/40"
                    />
                  </div>
                </div>

                {/* Duration filter */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <span className="text-xs font-black text-slate-300 flex items-center gap-1.5 mb-3">
                    <Clock3 size={14} className="text-[#D4AF37]" />
                    مدة الجلسة
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { v: "all", l: "الكل" },
                      { v: "short", l: "<30د" },
                      { v: "medium", l: "30-60د" },
                      { v: "long", l: ">60د" },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setDurationFilter(opt.v)}
                        aria-pressed={durationFilter === opt.v}
                        className={`h-9 rounded-xl text-[10px] font-black transition-all ${
                          durationFilter === opt.v
                            ? "bg-[#D4AF37] text-[#09090B]"
                            : "bg-white/5 text-slate-400 hover:text-white border border-white/10"
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Category pills (horizontal scroll) */}
      {categoriesWithCounts.length > 0 && (
        <div className="-mx-6 px-6 overflow-x-auto scrollbar-hidden">
          <LayoutGroup id="services-categories">
            <div className="flex gap-2 pb-2 min-w-min">
              <CategoryPill
                label="الكل"
                count={services.length}
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
                theme={theme}
              />
              {categoriesWithCounts.map((cat) => (
                <CategoryPill
                  key={`cat-${cat.id}`}
                  label={cat.name_ar || cat.name}
                  count={cat.count}
                  active={activeCategory === String(cat.id)}
                  onClick={() => setActiveCategory(String(cat.id))}
                  theme={theme}
                />
              ))}
            </div>
          </LayoutGroup>
        </div>
      )}

      {/* Results count + active filter chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-400">
          {filteredServices.length === 0 ? (
            "لا توجد نتائج"
          ) : (
            <>
              <span className="text-white font-black">{filteredServices.length}</span> خدمة
              {debouncedQuery && (
                <>
                  {" "}لـ "<span className="text-[#D4AF37]">{debouncedQuery}</span>"
                </>
              )}
            </>
          )}
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-black text-rose-500 hover:text-rose-400 flex items-center gap-1"
          >
            <X size={12} /> مسح كل الفلاتر
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="text-[#D4AF37] animate-spin" />
          <p className="text-sm font-bold text-slate-400">جاري التحميل...</p>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-rose-500">حدث خطأ في التحميل</p>
            <p className="text-xs text-rose-500/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredServices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="h-20 w-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Inbox size={36} className="text-slate-600" />
          </div>
          <div>
            <p className="text-base font-black text-white">لا توجد خدمات تطابق بحثك</p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              جرب تعديل الفلاتر أو البحث بكلمات أخرى
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              onClick={clearFilters}
              className="h-11 px-6 rounded-2xl font-black text-xs"
              style={{ backgroundColor: theme.primary, color: "#09090B" }}
            >
              مسح الفلاتر
            </Button>
          )}
        </div>
      )}

      {/* Services grid / list */}
      {!isLoading && !error && filteredServices.length > 0 && (
        <motion.div
          layout
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 lg:gap-8"
              : "flex flex-col gap-4"
          }
        >
          <AnimatePresence mode="popLayout">
            {filteredServices.map((svc) => (
              <ServiceCard
                key={`svc-${svc.id}`}
                service={svc}
                viewMode={viewMode}
                currency={currency}
                theme={theme}
                onBook={handleBook}
                bookmarked={bookmarkedIds.includes(svc.id)}
                onToggleBookmark={
                  onToggleBookmark ? () => onToggleBookmark(svc.id) : null
                }
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

// ───── Sub-components ─────

function CategoryPill({ label, count, active, onClick, theme }: { label: React.ReactNode; count: React.ReactNode; active?: boolean; onClick?: () => void; theme: LandingThemeTokens }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      aria-pressed={active}
      className="relative shrink-0 px-4 sm:px-5 py-2.5 rounded-2xl text-xs font-black border transition-colors flex items-center gap-2"
      style={{
        color: active ? "#09090B" : theme.dark,
        backgroundColor: active ? theme.primary : "transparent",
        borderColor: active ? theme.primary : `${theme.primary}20`,
      }}
    >
      <span>{label}</span>
      <span
        className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
        style={{
          backgroundColor: active ? "rgba(9,9,11,0.15)" : `${theme.primary}15`,
          color: active ? "#09090B" : theme.primary,
        }}
      >
        {count}
      </span>
    </motion.button>
  );
}

export interface ServiceCardProps {
  service: ServiceRecord;
  viewMode: string;
  currency: string;
  theme: LandingThemeTokens;
  onBook: (service: ServiceRecord) => void;
  bookmarked?: boolean;
  onToggleBookmark?: (() => void) | null;
}

function ServiceCard({ service, viewMode, currency, theme, onBook, bookmarked, onToggleBookmark }: ServiceCardProps) {
  const imageUrl =
    service.image_url || "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800";
  const duration = service.duration_minutes || service.duration;
  const isFeatured = service.is_featured;
  const isPopular =
    (Number(service.popularity) || Number(service.bookings_count) || 0) > 100;

  if (viewMode === "list") {
    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="group flex flex-col sm:flex-row gap-4 p-3 sm:p-4 rounded-3xl border border-white/10 bg-[#17171A] hover:border-[#D4AF37]/30 transition-all"
      >
        <div className="relative w-full sm:w-44 aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden shrink-0">
          <img
            src={imageUrl}
            alt={service.name_ar || service.name || "خدمة"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            srcSet={buildSrcSet(imageUrl, [240, 320, 480]) || undefined}
            sizes={buildSizes("(max-width: 640px) 100vw, 180px")}
          />
          {isFeatured && (
            <div className="absolute top-2 start-2 px-2 py-1 rounded-md text-[9px] font-black bg-[#D4AF37] text-[#09090B] flex items-center gap-1">
              <Sparkles size={10} /> مميز
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base sm:text-lg font-black text-white truncate">
              {service.name_ar || service.name}
            </h3>
            {onToggleBookmark && (
              <button
                onClick={onToggleBookmark}
                aria-label={bookmarked ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 hover:bg-rose-500/10 transition-colors"
              >
                <Star
                  size={14}
                  className={bookmarked ? "fill-rose-500 text-rose-500" : "text-slate-400"}
                />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
            {service.description_ar || service.description || "تجربة احترافية مميزة"}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-500">
            {duration && (
              <span className="flex items-center gap-1">
                <Clock3 size={10} /> {duration} دقيقة
              </span>
            )}
            {isPopular && (
              <span className="flex items-center gap-1 text-amber-500">
                <TrendingUp size={10} /> رائج
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-auto pt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-[#D4AF37]">
                {service.price}
              </span>
              <span className="text-xs font-bold text-slate-500">{currency}</span>
            </div>
            <Button
              onClick={() => onBook(service)}
              className="h-10 px-4 sm:px-5 rounded-xl font-black text-[10px] sm:text-xs"
              style={{ backgroundColor: theme.primary, color: "#09090B" }}
            >
              احجز الآن
            </Button>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="group relative rounded-3xl border border-white/10 bg-[#17171A] hover:border-[#D4AF37]/30 transition-all overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div className="relative h-48 sm:h-56 overflow-hidden">
        <img
          src={imageUrl}
          alt={service.name_ar || service.name || "خدمة"}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          srcSet={buildSrcSet(imageUrl, [320, 480, 640, 800]) || undefined}
          sizes={buildSizes(
            "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw",
          )}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#17171A] via-transparent to-transparent" />

        {/* Badges top-left */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          {isFeatured && (
            <span className="px-2 py-1 rounded-md text-[9px] font-black bg-[#D4AF37] text-[#09090B] flex items-center gap-1">
              <Sparkles size={10} /> مميز
            </span>
          )}
          {isPopular && (
            <span className="px-2 py-1 rounded-md text-[9px] font-black bg-amber-500 text-[#09090B] flex items-center gap-1">
              <TrendingUp size={10} /> رائج
            </span>
          )}
        </div>

        {/* Bookmark top-right */}
        {onToggleBookmark && (
          <button
            onClick={onToggleBookmark}
            aria-label={bookmarked ? "إزالة من المفضلة" : "إضافة للمفضلة"}
            className="absolute top-3 end-3 h-8 w-8 rounded-lg flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 hover:bg-rose-500/20 transition-colors"
          >
            <Star
              size={14}
              className={bookmarked ? "fill-rose-500 text-rose-500" : "text-white"}
            />
          </button>
        )}

        {/* Price badge bottom-right */}
        <div className="absolute bottom-3 end-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-[#D4AF37]/30 text-xs font-black text-[#D4AF37]">
          {service.price} {currency}
        </div>

        {/* Duration badge bottom-left */}
        {duration && (
          <div className="absolute bottom-3 start-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-black text-white flex items-center gap-1">
            <Clock3 size={10} /> {duration}د
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <h3 className="text-base sm:text-lg font-black text-white line-clamp-1">
          {service.name_ar || service.name}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 min-h-[2.4em]">
          {service.description_ar || service.description || "تجربة احترافية مميزة"}
        </p>

        <Button
          onClick={() => onBook(service)}
          className="w-full h-10 mt-4 rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5"
          style={{
            backgroundColor: "rgba(212, 175, 55, 0.1)",
            color: theme.primary,
            border: `1px solid ${theme.primary}30`,
          }}
        >
          <CalendarCheck2 size={14} /> احجز هذه الخدمة
        </Button>
      </div>
    </motion.article>
  );
}
