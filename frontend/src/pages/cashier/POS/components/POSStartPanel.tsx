import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Gift,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { usePOS } from "@/features/pos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";

/**
 * The idle middle column: the till's two entry points.
 *
 * Reception sessions remain the path for services. The manual sale is now a
 * single, explicit product sale: care products and product-only offers, taken
 * off the shelf and issued as a normal invoice with no services and no expert.
 */
const POSStartPanel = () => {
  const { t } = useTranslation("pos");
  const {
    startSaleMode,
    startQuickSale,
    products,
    productOffers,
    readyAppointments,
  } = usePOS();

  const stats = [
    {
      id: "products",
      icon: Package,
      value: products.length,
      label: t("start.stats_products"),
    },
    {
      id: "offers",
      icon: Gift,
      value: productOffers.length,
      label: t("start.stats_offers"),
    },
    {
      id: "sessions",
      icon: CalendarClock,
      value: readyAppointments.length,
      label: t("start.stats_sessions"),
    },
  ];

  const guarantees = [
    t("start.badge_no_expert"),
    t("start.badge_stock"),
    t("start.badge_invoice"),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto py-1 no-scrollbar">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-info/10 p-4 sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-10 -top-12 h-36 w-36 rounded-full bg-primary/15 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -start-10 h-40 w-40 rounded-full bg-info/10 blur-2xl"
        />

        <div className="relative space-y-4">
          <Badge variant="primary" size="sm" className="gap-1">
            <Sparkles size={11} aria-hidden="true" />
            {t("start.products_eyebrow")}
          </Badge>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black leading-tight tracking-tight text-main sm:text-2xl">
              {t("start.products_title")}
            </h2>
            <p className="max-w-xl text-[11px] font-bold leading-relaxed text-muted">
              {t("start.products_desc")}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {guarantees.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/80 px-2 py-1 text-[9px] font-black text-muted"
              >
                <Check size={10} className="text-success" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => startSaleMode("products")}
            className={cn(
              "group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-md shadow-primary/20 transition-all",
              "hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 touch-target",
            )}
          >
            <ShoppingBag size={17} aria-hidden="true" />
            {t("start.products_cta")}
            <ArrowLeft
              size={15}
              aria-hidden="true"
              className="transition-transform group-hover:-translate-x-0.5"
            />
          </button>

          <dl className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="rounded-xl border border-border/50 bg-card/70 px-2.5 py-2"
              >
                <dt className="flex items-center gap-1 text-[9px] font-black text-muted">
                  <stat.icon size={10} aria-hidden="true" />
                  <span className="truncate">{stat.label}</span>
                </dt>
                <dd className="mt-0.5 text-lg font-black tabular-nums leading-none text-main">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Quick Sale — walk-in service sale with no appointment. */}
      <section className="rounded-2xl border border-border/60 bg-soft/25 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
            <Plus size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-black text-main">
                {t("quick_sale.title")}
              </h3>
            </div>
            <p className="mt-1 text-[10px] font-bold leading-relaxed text-muted">
              {t("quick_sale.desc")}
            </p>
            <button
              type="button"
              onClick={startQuickSale}
              className={cn(
                "mt-2 group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-md shadow-primary/20 transition-all",
                "hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 touch-target",
              )}
            >
              <Plus size={16} aria-hidden="true" />
              {t("quick_sale.cta")}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-soft/25 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
            <CalendarClock size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-black text-main">
                {t("start.sessions_title")}
              </h3>
              {readyAppointments.length > 0 && (
                <Badge variant="secondary" size="sm" className="tabular-nums">
                  {readyAppointments.length}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[10px] font-bold leading-relaxed text-muted">
              {t("start.sessions_desc")}
            </p>
            <p className="mt-2 text-[10px] font-bold leading-relaxed text-muted/80">
              {t("start.sessions_hint")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default POSStartPanel;
