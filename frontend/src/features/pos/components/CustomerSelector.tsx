import React from "react";
import { Search, User, UserPlus, X, Loader2, Phone } from "lucide-react";
import { usePOS } from "@/features/pos";
import { resolveCustomerTier } from "@/features/pos/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";

/**
 * Customer picker for the till.
 *
 * The till used to pre-load the whole customer table and filter it locally,
 * while no UI ever displayed it — a walk-in sale or a reception session was
 * the only way to attach a customer. This is the missing piece: a typeahead
 * that asks the server for exactly the rows it shows (see the debounced
 * effect in usePOSLogic), plus the walk-in / new-customer paths that the
 * checkout payload already supports.
 */
export const CustomerSelector = () => {
  const {
    customerSearchQuery,
    setCustomerSearchQuery,
    customerSearchResults,
    customerSearchLoading,
    customerSearchError,
    selectedCustomer,
    selectCustomer,
    businessSettings,
    isNewCustomer,
    setIsNewCustomer,
    newCustomerFirstName,
    setNewCustomerFirstName,
    newCustomerPhone,
    setNewCustomerPhone,
  } = usePOS();

  const showResults =
    customerSearchQuery.trim().length >= 2 &&
    (customerSearchResults.length > 0 || customerSearchLoading || !!customerSearchError);

  const firstName = (c: Record<string, unknown>) =>
    String(c.first_name ?? c.firstName ?? "").trim();
  const lastName = (c: Record<string, unknown>) =>
    String(c.last_name ?? c.lastName ?? "").trim();
  const phone = (c: Record<string, unknown>) =>
    String(c.phone_primary ?? c.phonePrimary ?? c.phone ?? "").trim();

  const displayName = (c: Record<string, unknown>) => {
    const full = `${firstName(c)} ${lastName(c)}`.trim();
    return full || phone(c) || "عميل بدون اسم";
  };

  // Tier label + colour come from the owner's configured ladder, resolved by
  // visit count. The stored `current_tier` string is not used: it holds
  // whatever name the owner gave the tier (and legacy rows still hold
  // "Bronze"), which is why the badge used to show an English code.
  const tierFor = (c: Record<string, unknown> | null) =>
    resolveCustomerTier(c, businessSettings?.loyalty_settings);

  // A picked customer closes the new-customer form: the two are mutually
  // exclusive, and leaving both open would send a customer_id AND a new
  // customer's name/phone to the server.
  const pick = (customer: Record<string, unknown>) => {
    setIsNewCustomer(false);
    selectCustomer(customer as never);
  };

  const startNewCustomer = () => {
    selectCustomer(null);
    setIsNewCustomer(true);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-soft/40 p-3">
      {/* Selected customer */}
      {selectedCustomer && !isNewCustomer ? (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <User size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-main truncate">
              {displayName(selectedCustomer)}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
              <span className="flex items-center gap-1 truncate">
                <Phone size={10} />
                {phone(selectedCustomer) || "—"}
              </span>
              {(() => {
                const tier = tierFor(selectedCustomer);
                if (!tier) return null;
                return tier.discount_percent > 0 ? (
                  <span className="text-success shrink-0">
                    خصم {tier.discount_percent}%
                  </span>
                ) : null;
              })()}
            </div>
          </div>
          {(() => {
            const tier = tierFor(selectedCustomer);
            return tier ? (
              <Badge
                className={cn(
                  "rounded-lg border-none font-black text-[10px] uppercase shrink-0 text-white",
                  tier.color || "bg-accent",
                )}
              >
                {tier.name}
              </Badge>
            ) : null;
          })()}
          <button
            onClick={() => selectCustomer(null)}
            aria-label="إزالة العميل"
            className="shrink-0 h-7 w-7 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      ) : isNewCustomer ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
              <UserPlus size={16} />
            </div>
            <span className="text-xs font-black text-main">عميل جديد</span>
            <button
              onClick={() => setIsNewCustomer(false)}
              className="mr-auto h-7 w-7 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors flex items-center justify-center"
              aria-label="إلغاء عميل جديد"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="الاسم"
              value={newCustomerFirstName}
              onChange={(e) => setNewCustomerFirstName(e.target.value)}
              className="h-9 rounded-xl text-xs font-bold border-border/50"
            />
            <Input
              placeholder="التليفون"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              className="h-9 rounded-xl text-xs font-bold border-border/50"
              inputMode="tel"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              size={15}
            />
            <Input
              placeholder="ابحث باسم العميل أو رقم التليفون..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              className="pe-9 h-10 rounded-xl border-border/50 text-xs font-bold"
            />
            {customerSearchLoading && (
              <Loader2
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted animate-spin"
                size={14}
              />
            )}
          </div>

          {customerSearchError && (
            <p className="text-[10px] font-bold text-danger">{customerSearchError}</p>
          )}

          {showResults && (
            <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1">
              {customerSearchResults.map((c) => {
                const key = String(c.customer_id ?? c.id);
                return (
                  <button
                    key={key}
                    onClick={() => pick(c)}
                    className="w-full text-right px-2.5 py-2 rounded-xl border border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-black text-main truncate">
                        {displayName(c)}
                      </div>
                      <div className="text-[10px] font-bold text-muted truncate">
                        {phone(c) || "—"}
                      </div>
                    </div>
                    {(() => {
                      const tier = tierFor(c);
                      return tier ? (
                        <Badge
                          className={cn(
                            "rounded-lg border-none font-black text-[10px] uppercase shrink-0 text-white",
                            tier.color || "bg-accent",
                          )}
                        >
                          {tier.name}
                        </Badge>
                      ) : null;
                    })()}
                  </button>
                );
              })}
            </div>
          )}

          {!showResults && customerSearchQuery.trim().length >= 2 && !customerSearchLoading && (
            <p className="text-[10px] font-bold text-muted text-center py-1">
              لا توجد نتائج مطابقة
            </p>
          )}

          <Button
            variant="ghost"
            onClick={startNewCustomer}
            className={cn(
              "w-full h-9 rounded-xl font-black text-[11px] border border-dashed",
              "border-border/60 text-muted hover:text-primary hover:border-primary/40",
            )}
          >
            <UserPlus size={14} /> عميل جديد
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomerSelector;