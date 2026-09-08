import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/core/utils";
import {
  X,
  ChevronDown,
  Tag,
  Package,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function FilterPanel({
  isOpen,
  onClose,
  onApply,
  onClear,
  filters,
  categories,
  units,
  activeFilterCount = 0,
  className,
}) {
  const [localFilters, setLocalFilters] = useState(filters);
  const panelRef = useRef(null);

  // Sync with parent filters
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key, value) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClear = () => {
    const clearedFilters = {
      categories: [],
      unit: "",
      status: { stable: false, lowStock: false, archived: false },
      priceRange: [0, 5000],
    };
    setLocalFilters(clearedFilters);
    onClear?.(clearedFilters);
  };

  const handleApply = () => {
    onApply?.(localFilters);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-panel-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed inset-y-0 right-0 w-full max-w-sm lg:max-w-md bg-card shadow-premium transform transition-transform duration-300 ease-spring",
          "flex flex-col overflow-hidden",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-soft/50 sticky top-0 z-10">
          <h2
            id="filter-panel-title"
            className="text-lg font-extrabold text-main"
          >
            فلترة المنتجات
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={onClose}
            aria-label="إغلاق الفلاتر"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Categories */}
          <FilterSection
            title="التصنيف"
            icon={Tag}
            description={`${categories.length} تصنيف متاح`}
          >
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {categories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <Checkbox
                    checked={localFilters.categories?.includes(cat)}
                    onCheckedChange={(checked) => {
                      const current = localFilters.categories || [];
                      handleChange(
                        "categories",
                        checked
                          ? [...current, cat]
                          : current.filter((c) => c !== cat),
                      );
                    }}
                    className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                  />
                  <span className="text-sm font-bold text-main group-hover:text-accent transition-colors">
                    {cat}
                  </span>
                </label>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted text-center py-4">
                  لا توجد تصنيفات
                </p>
              )}
            </div>
          </FilterSection>

          {/* Unit */}
          <FilterSection
            title="وحدة القياس"
            icon={Package}
            description="نوع وحدة القياس"
          >
            <Select
              value={localFilters.unit || ""}
              onValueChange={(v) => handleChange("unit", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="جميع الوحدات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">جميع الوحدات</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSection>

          {/* Status */}
          <FilterSection
            title="حالة المخزون"
            icon={Layers}
            description="تصفية حسب مستوى المخزون"
          >
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={localFilters.status?.stable}
                  onCheckedChange={(checked) =>
                    handleChange("status", {
                      ...localFilters.status,
                      stable: checked,
                    })
                  }
                  className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-sm font-bold text-main">
                    مستقر (أعلى من ضعف الحد الأدنى)
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={localFilters.status?.lowStock}
                  onCheckedChange={(checked) =>
                    handleChange("status", {
                      ...localFilters.status,
                      lowStock: checked,
                    })
                  }
                  className="data-[state=checked]:bg-warning data-[state=checked]:border-warning"
                />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <span className="text-sm font-bold text-main">
                    نواقص (أقل من أو يساوي الحد الأدنى)
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={localFilters.status?.archived}
                  onCheckedChange={(checked) =>
                    handleChange("status", {
                      ...localFilters.status,
                      archived: checked,
                    })
                  }
                  className="data-[state=checked]:bg-muted data-[state=checked]:border-muted"
                />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-muted" />
                  <span className="text-sm font-bold text-main">مؤرشف</span>
                </div>
              </label>
            </div>
          </FilterSection>

          {/* Price Range */}
          <FilterSection
            title="نطاق السعر"
            icon={SlidersHorizontal}
            description="سعر البيع للجنيه المصري"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    الحد الأدنى
                  </label>
                  <Input
                    type="number"
                    value={localFilters.priceRange?.[0] || 0}
                    onChange={(e) =>
                      handleChange("priceRange", [
                        Number(e.target.value),
                        localFilters.priceRange?.[1] || 5000,
                      ])
                    }
                    className="h-11 rounded-xl bg-soft border-border font-black text-center"
                    min="0"
                    step="10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    الحد الأقصى
                  </label>
                  <Input
                    type="number"
                    value={localFilters.priceRange?.[1] || 5000}
                    onChange={(e) =>
                      handleChange("priceRange", [
                        localFilters.priceRange?.[0] || 0,
                        Number(e.target.value),
                      ])
                    }
                    className="h-11 rounded-xl bg-soft border-border font-black text-center"
                    min="0"
                    step="10"
                  />
                </div>
              </div>

              {/* Range Slider (visual) */}
              <div className="relative h-2 bg-border/50 rounded-full">
                <div
                  className="absolute h-full bg-accent rounded-full transition-all duration-200"
                  style={{
                    left: `${((localFilters.priceRange?.[0] || 0) / 5000) * 100}%`,
                    width: `${(((localFilters.priceRange?.[1] || 5000) - (localFilters.priceRange?.[0] || 0)) / 5000) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-muted uppercase tracking-widest">
                <span>0 ج.م</span>
                <span>5000+ ج.م</span>
              </div>
            </div>
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-soft/50 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 h-12 rounded-xl font-black uppercase text-xs"
            onClick={handleClear}
          >
            <X size={16} className="ml-2" /> مسح الكل
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl font-black uppercase text-xs shadow-lg shadow-accent/20"
            onClick={handleApply}
          >
            تطبيق ({activeFilterCount}){" "}
            <ChevronDown size={16} className="mr-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, icon: Icon, description, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
          <Icon size={18} className="text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-main">{title}</h3>
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
            {description}
          </p>
        </div>
      </div>
      <div className="border-r-2 border-border/30 mr-5 pr-4">{children}</div>
    </div>
  );
}

export default FilterPanel;
