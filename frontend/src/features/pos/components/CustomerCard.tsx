import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Phone, User, UserCheck, UserPlus, Loader2 } from "lucide-react";
import { usePOS } from "@/features/pos";
import { resolveCustomerTier } from "@/features/pos/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";

/**
 * The customer block at the top of the cart column.
 *
 * There is deliberately no customer search and no "new customer" toggle: the
 * sale is identified by a mandatory full name and an optional mobile. A phone
 * that matches an existing customer attaches that record (and its loyalty
 * discount); an unmatched or blank phone keeps the typed name on the invoice
 * snapshot. Reception sessions arrive with both fields prefilled and locked,
 * because the appointment already owns the buyer.
 */
export const CustomerCard = () => {
  const { t } = useTranslation("pos");
  const {
    saleMode,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerMatch,
    customerLookupLoading,
    customerLookupError,
    isCustomerLocked,
    customerValidation,
    businessSettings,
  } = usePOS();

  const [touched, setTouched] = useState<{ name: boolean; phone: boolean }>({
    name: false,
    phone: false,
  });

  const showError =
    (touched.name || touched.phone) && Boolean(customerValidation.message);

  const tier = customerMatch
    ? resolveCustomerTier(customerMatch, businessSettings?.loyalty_settings)
    : null;

  const matchName = customerMatch
    ? `${String(customerMatch.first_name ?? customerMatch.firstName ?? "").trim()} ${String(
        customerMatch.last_name ?? customerMatch.lastName ?? "",
      ).trim()}`.trim()
    : "";

  const badge = isCustomerLocked ? (
    <Badge variant="secondary" size="sm" className="gap-1">
      <Lock size={9} />
      {t("customer.badge_session")}
    </Badge>
  ) : customerMatch ? (
    <Badge variant="success" size="sm" className="gap-1">
      <UserCheck size={9} />
      {t("customer.badge_registered")}
    </Badge>
  ) : (
    <Badge variant="outline" size="sm" className="gap-1">
      <UserPlus size={9} />
      {t("customer.badge_new")}
    </Badge>
  );

  return (
    <Card className="shrink-0 border-border/60 bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-black text-main">
          <User size={14} className="text-primary" />
          {t("customer.title")}
        </h2>
        {badge}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)]">
        <div className="space-y-1">
          <label
            htmlFor="pos-customer-name"
            className="text-[10px] font-black uppercase tracking-wider text-muted"
          >
            {t("customer.name_label")}
          </label>
          <div className="relative">
            <User
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              id="pos-customer-name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              readOnly={isCustomerLocked}
              aria-readonly={isCustomerLocked || undefined}
              aria-invalid={showError && !customerValidation.valid}
              aria-describedby="pos-customer-hint"
              maxLength={200}
              autoComplete="off"
              placeholder={t("customer.name_ph")}
              className={cn(
                "h-10 rounded-xl ps-8 text-xs font-bold",
                isCustomerLocked && "bg-soft/60 text-muted",
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="pos-customer-phone"
            className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted"
          >
            {t("customer.phone_label")}
            <span className="font-bold normal-case text-muted/70">
              ({t("customer.optional")})
            </span>
          </label>
          <div className="relative">
            <Phone
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              id="pos-customer-phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
              readOnly={isCustomerLocked}
              aria-readonly={isCustomerLocked || undefined}
              aria-invalid={
                showError && !customerValidation.valid && Boolean(customerPhone)
              }
              aria-describedby="pos-customer-hint"
              inputMode="tel"
              autoComplete="off"
              maxLength={30}
              placeholder={t("customer.phone_ph")}
              className={cn(
                "h-10 rounded-xl ps-8 pe-8 text-xs font-bold tabular-nums",
                isCustomerLocked && "bg-soft/60 text-muted",
              )}
            />
            {customerLookupLoading && (
              <Loader2
                size={13}
                aria-hidden="true"
                className="absolute end-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted"
              />
            )}
          </div>
        </div>
      </div>

      <div id="pos-customer-hint" className="mt-2 space-y-1">
        {isCustomerLocked ? (
          <p className="flex items-start gap-1 text-[10px] font-bold leading-relaxed text-muted">
            <Lock size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t("customer.locked_hint")}
          </p>
        ) : customerMatch ? (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] font-bold leading-relaxed text-success">
            <UserCheck size={11} aria-hidden="true" />
            <span>
              {t("customer.registered_hint", { name: matchName || "—" })}
            </span>
            {tier?.discount_percent ? (
              <span className="rounded-md bg-success-soft px-1.5 py-0.5 font-black">
                {t("customer.discount_percent", {
                  percent: tier.discount_percent,
                })}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-[10px] font-bold leading-relaxed text-muted">
            {t("customer.three_parts_hint")}
          </p>
        )}

        {customerLookupError && (
          <p className="text-[10px] font-bold text-danger">{customerLookupError}</p>
        )}

        {showError && !customerValidation.valid && (
          <p role="alert" className="text-[10px] font-black text-danger">
            {customerValidation.message}
          </p>
        )}

        {!isCustomerLocked &&
          !customerMatch &&
          customerPhone.trim() &&
          !customerLookupLoading &&
          !customerLookupError && (
            <p className="text-[10px] font-bold text-muted">
              {t("customer.unmatched_hint")}
            </p>
          )}
      </div>

      {saleMode === "products" && (
        <p className="mt-2 rounded-lg bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary">
          {t("products_sale.no_barber_hint")}
        </p>
      )}
    </Card>
  );
};

export default CustomerCard;
