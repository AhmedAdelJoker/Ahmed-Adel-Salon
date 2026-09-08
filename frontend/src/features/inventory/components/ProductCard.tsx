import React from "react";
import { cn, formatCurrency } from "@/lib/core/utils";
import {
  getProductStatusToken,
  getProductStatusLabel,
  getCategoryTone,
} from "@/features/inventory/design-tokens";
import { PremiumCard } from "@/components/shared/PremiumUI";

/**
 * SmartStatusBar - The signature element of the inventory redesign
 * A thin horizontal bar that visually represents stock health
 */
export function SmartStatusBar({
  product,
  className,
}: {
   
  product: any;
  className?: string;
}) {
  const qty = Number(product?.quantity || 0);
  const threshold = Number(product?.min_quantity_alert || 0);
  const isArchived = product?.is_archived;

  // Calculate percentage for the bar fill
  let percentage = 100;
  let statusColor = "var(--inv-stable)";

  if (isArchived) {
    percentage = 100;
    statusColor = "var(--inv-archived)";
  } else if (qty <= 0) {
    percentage = 0;
    statusColor = "var(--inv-critical)";
  } else if (qty <= threshold) {
    percentage = Math.max(10, Math.round((qty / Math.max(threshold, 1)) * 100));
    statusColor = "var(--inv-warning)";
  } else {
    // Stable: show as 100% but could show ratio to 2x threshold
    const maxHealthy = threshold * 2;
    percentage = Math.min(
      100,
      Math.round((qty / Math.max(maxHealthy, 1)) * 100),
    );
    statusColor = "var(--inv-stable)";
  }

  return (
    <div
      className={cn(
        "h-1 w-full rounded-full bg-border overflow-hidden",
        "transition-all duration-500 ease-spring",
        className,
      )}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`حالة المخزون: ${getProductStatusLabel(product)}`}
    >
      <div
        className="h-full rounded-full transition-all duration-500 ease-spring"
        style={{
          width: `${percentage}%`,
          backgroundColor: statusColor,
          opacity: isArchived ? 0.5 : 1,
        }}
      />
    </div>
  );
}

/**
 * StatusBadge - Unified status indicator for products
 */
export interface StatusBadgeProps {
   
  product: any;
  size?: "sm" | "md" | "lg" | string;
  className?: string;
}

export function StatusBadge({ product, size = "md", className }: StatusBadgeProps) {
  const token = getProductStatusToken(product);
  const label = getProductStatusLabel(product);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[9px] h-5",
    md: "px-2.5 py-1 text-[10px] h-6",
    lg: "px-3 py-1.5 text-[11px] h-7",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-black uppercase tracking-widest rounded-full border",
        "transition-colors duration-200",
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: `${token.soft}`,
        color: token.DEFAULT,
        borderColor: `${token.DEFAULT}33`, // 20% opacity
      }}
    >
      {label}
    </span>
  );
}

/**
 * CategoryIcon - Colored icon wrapper based on product category
 * NOTE: The actual icon rendering uses CategoryIconDisplay below.
 * This component is kept as a thin styled wrapper that accepts the icon as children.
 */
export interface CategoryIconProps {
  category?: string;
  size?: "sm" | "md" | "lg" | string;
  className?: string;
  children?: React.ReactNode;
}

export function CategoryIcon({ category, size = "md", className, children }: CategoryIconProps) {
  const tone = getCategoryTone(category);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border shadow-sm",
        "transition-all duration-300",
        sizeClasses[size],
        className,
      )}
      style={{
        backgroundColor: tone.bg,
        borderColor: `${tone.border}33`,
        color: tone.text,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Metric - Reusable key-value display for product vitals
 */
export interface MetricProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  accent?: boolean;
  variant?: "default" | "success" | "warning" | "muted" | string;
  className?: string;
  children?: React.ReactNode;
}

export function Metric({
  label,
  value,
  accent = false,
  variant = "default", // default, success, warning, muted
  className,
  children,
}: MetricProps) {
  const variantStyles = {
    default: {
      valueColor: "var(--inv-text)",
      labelColor: "var(--inv-text-muted)",
    },
    success: {
      valueColor: "var(--inv-stable)",
      labelColor: "var(--inv-stable)",
    },
    warning: {
      valueColor: "var(--inv-warning)",
      labelColor: "var(--inv-warning)",
    },
    muted: {
      valueColor: "var(--inv-text-muted)",
      labelColor: "var(--inv-text-soft)",
    },
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors group-hover:bg-card",
        "border-border/60 bg-soft/50",
        className,
      )}
    >
      <div className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">
        {label}
      </div>
      <div
        className={cn("text-sm font-black", accent ? "text-accent" : "")}
        style={{
          color: accent ? "var(--accent)" : style.valueColor,
        }}
      >
        {value}
        {children}
      </div>
    </div>
  );
}

/**
 * ProductCard - The redesigned product card with 3-layer architecture
 * Layer 1: Identity (always visible)
 * Layer 2: Vital Stats (critical info)
 * Layer 3: Actions (revealed on hover/focus)
 */
export function ProductCard({
  product,
  onEdit,
  onSupply,
  onHistory,
  onViewDetails,
  unitMeta,
  availablePacks,
  hasStock,
  isLowStock,
  className,
}) {
  const statusToken = getProductStatusToken(product);
  const categoryTone = getCategoryTone(product.category);
  const statusLabel = getProductStatusLabel(product);

  // Determine if we should show edit button (only when quantity === 0)
  const canEdit = Number(product?.quantity || 0) === 0 && !product?.is_archived;

  // Smart status bar percentage
  const qty = Number(product?.quantity || 0);
  const threshold = Number(product?.min_quantity_alert || 0);
  let statusPercentage = 100;
  if (product?.is_archived) statusPercentage = 100;
  else if (qty <= 0) statusPercentage = 0;
  else if (qty <= threshold)
    statusPercentage = Math.max(
      10,
      Math.round((qty / Math.max(threshold, 1)) * 100),
    );
  else {
    const maxHealthy = threshold * 2;
    statusPercentage = Math.min(
      100,
      Math.round((qty / Math.max(maxHealthy, 1)) * 100),
    );
  }

  return (
    <PremiumCard
      hoverable={true}
      animate={true}
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "hover:shadow-premium hover:border-accent/30",
        "data-[low-stock]:border-warning/30 data-[low-stock]:bg-warning-soft/30",
        "data-[archived]:opacity-60 data-[archived]:grayscale",
        className,
      )}
      data-low-stock={isLowStock && !product?.is_archived ? "" : undefined}
      data-archived={product?.is_archived ? "" : undefined}
    >
      {/* Smart Status Bar - Signature Element */}
      <div
        className="h-1 w-full rounded-t-none overflow-hidden"
        style={{ backgroundColor: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-spring"
          style={{
            width: `${statusPercentage}%`,
            backgroundColor: product?.is_archived
              ? "var(--inv-archived)"
              : qty <= 0
                ? "var(--inv-critical)"
                : qty <= threshold
                  ? "var(--inv-warning)"
                  : "var(--inv-stable)",
            opacity: product?.is_archived ? 0.5 : 1,
          }}
        />
      </div>

      <div className="p-6 space-y-5">
        {/* LAYER 1: Identity */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm"
              style={{
                backgroundColor: categoryTone.bg,
                borderColor: `${categoryTone.border}33`,
                color: categoryTone.text,
              }}
            >
              {/* Category icon will be passed via children or context */}
              <CategoryIconDisplay category={product.category} size={20} />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="text-lg font-extrabold text-main leading-tight truncate">
                {product.name}
              </h4>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
                {product.company_name ? `${product.company_name} • ` : ""}
                {product.category || "بدون تصنيف"}
              </p>
            </div>
          </div>
          <StatusBadge product={product} size="md" />
        </div>

        {/* LAYER 2: Vital Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Metric
            label="سعة العبوة"
            value={
              product.weight
                ? `${product.weight} ${unitMeta.shortLabel}`
                : "---"
            }
          />
          <Metric
            label="الرصيد"
            value={
              product.weight
                ? `${availablePacks} عبوة`
                : `${qty} ${unitMeta.shortLabel}`
            }
            accent={true}
            variant={isLowStock ? "warning" : "success"}
          />
          <Metric
            label="البيع"
            value={
              product.sell_price
                ? formatCurrency(Number(product.sell_price))
                : "---"
            }
            variant="success"
          />
          <Metric
            label="التكلفة"
            value={
              product.cost_price
                ? formatCurrency(Number(product.cost_price))
                : "---"
            }
            variant="muted"
          />
        </div>

        {/* Additional Info Row */}
        <div className="rounded-2xl border border-border/60 bg-soft/50 p-4 flex items-center justify-between group-hover:bg-card transition-colors">
          <div>
            <div className="text-[8px] font-black text-muted uppercase">
              إجمالي الكمية
            </div>
            <div className="text-base font-black text-main font-data">
              {product.weight
                ? `${(qty / (product.weight || 1)).toFixed(1)} ${unitMeta.label}`
                : `${qty} ${unitMeta.label}`}
            </div>
          </div>
          <button
            onClick={() => onHistory?.(product)}
            className="h-9 w-9 rounded-xl bg-soft border border-border flex items-center justify-center text-muted hover:bg-card hover:text-accent hover:border-accent/30 transition-all"
            title="سجل الحركات"
            aria-label="عرض سجل حركات هذا المنتج"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>

        {/* LAYER 3: Actions - Visible on hover/focus */}
        <div className="space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-2">
            {canEdit && (
              <button
                onClick={() => onEdit?.(product)}
                className="flex-1 rounded-xl h-10 text-xs font-black border border-border bg-soft hover:bg-card transition-colors"
                tabIndex={0}
              >
                تعديل
              </button>
            )}
            <button
              onClick={() => onSupply?.(product)}
              className={cn(
                "flex-1 rounded-xl h-10 text-xs font-black transition-all",
                !hasStock
                  ? "bg-accent/10 border-accent/20 text-accent hover:bg-accent/20"
                  : "bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:shadow-accent/30",
              )}
              tabIndex={0}
            >
              <svg
                className="h-4 w-4 inline ml-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              توريد
            </button>
          </div>
        </div>
      </div>
    </PremiumCard>
  );
}

/**
 * CategoryIconDisplay - Renders the appropriate icon for a category
 * Since we can't dynamically import lucide icons, we use a simple mapping
 */
function CategoryIconDisplay({ category, size = 20 }: { category?: string; size?: number }) {
  const normalized = String(category || "").toLowerCase();
  const isOil =
    normalized.includes("زيت") ||
    normalized.includes("serum") ||
    normalized.includes("سيروم");

  return (
    <svg
      className={cn("h-5 w-5", `h-[${size}px] w-[${size}px]`)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isOil ? (
        // Droplets icon
        <>
          <path d="M12 2.69a5.5 5.5 0 0 1 10.59 5.32c.68 1.96.54 4.19-.6 5.92a5.34 5.34 0 0 1-7.57 3.75 5.73 5.73 0 0 1-2.42-.96 5.5 5.5 0 0 1-1.42-4.47c0-1.5.5-2.87 1.4-4.01a5.5 5.5 0 0 1 10.59-5.32z" />
          <path d="M8 15.5a4 4 0 0 1 4-4h.01" />
        </>
      ) : (
        // Box icon
        <>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </>
      )}
    </svg>
  );
}

export default ProductCard;
