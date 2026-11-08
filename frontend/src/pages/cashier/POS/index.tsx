import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { POSProvider, usePOS } from "@/pages/cashier/POS/POSContext";
import SessionsQueue from "@/pages/cashier/POS/components/SessionsQueue";
import ItemSelection from "@/pages/cashier/POS/components/ItemSelection";
import CheckoutBar from "@/pages/cashier/POS/components/CheckoutBar";
import POSStartPanel from "@/pages/cashier/POS/components/POSStartPanel";
import POSHeader from "@/pages/cashier/POS/components/POSHeader";
import SuccessOverlay from "@/pages/cashier/POS/components/SuccessOverlay";
import ManagerApprovalModal from "@/pages/cashier/POS/components/ManagerApprovalModal";
import POSBottomNav from "@/pages/cashier/POS/components/POSBottomNav";
import { cn } from "@/lib/core/utils";
import { toast } from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { RefreshCw, UploadCloud, WifiOff } from "lucide-react";
import { ErrorState } from "@/components/shared/AsyncState";
import InlineNotice from "@/components/shared/InlineNotice";
import { PageShell } from "@/components/shared/PageShell";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import type { ID } from "@/types/common";
import type { POSRecord } from "@/features/pos/types";

/**
 * Navigation state `/bookings` passes with `handleTransferToPOS`. A booking
 * that arrives here must land as a prepared session — cart, customer and
 * barber pre-filled — not as a plain route change.
 */
interface BookingHandoffState {
  bookingId?: ID;
  customerId?: ID;
  barberId?: ID;
  services?: POSRecord[];
}

const POSLayout = () => {
  const { t } = useTranslation("pos");
  const {
    loading,
    readyAppointments,
    cart,
    shiftError,
    readyAppointmentsError,
    catalogError,
    saleMode,
    loadSession,
  } = usePOS();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileView, setMobileView] = useState("ops"); // "ops" | "items" | "cart"

  // Offline money-safety: LAN/server down keeps the till alive — invoices are
  // queued locally under their idempotency key and auto-replayed on reconnect.
  const { isOffline, pendingCount, replaying, replay } = useOfflineSync();

  const handoff = (location.state ?? null) as BookingHandoffState | null;
  const handoffBookingId = handoff?.bookingId ?? null;
  const consumedHandoff = useRef(false);

  // Mobile follows the sale: a loaded session lands on the cart, a product
  // sale lands on the catalogue, finishing/resetting returns to the queue.
  useEffect(() => {
    if (saleMode === "idle") setMobileView("ops");
    else if (saleMode === "session") setMobileView("cart");
    else if (saleMode === "products") setMobileView("items");
  }, [saleMode]);

  // Consume the `/bookings` handoff once the catalogue has loaded (the barber
  // list arrives in phase 1), then clear the navigation state so a browser
  // refresh does not re-apply it.
  useEffect(() => {
    if (loading || !handoffBookingId || consumedHandoff.current) return;
    consumedHandoff.current = true;

    const services = handoff?.services ?? [];
    loadSession(
      {
        id: handoffBookingId,
        barber_id: handoff?.barberId ?? "",
        customer_id: handoff?.customerId ?? null,
        services,
      },
      { notify: false },
    );

    if (services.length > 0) {
      toast.success(t("logic.handoff_loaded"));
    } else {
      toast(t("logic.handoff_no_services"), { icon: "⚠️" });
    }
    setMobileView("cart");
    navigate("/pos", { replace: true, state: null });
  }, [loading, handoffBookingId, handoff, loadSession, navigate, t]);

  // Global keyboard shortcut: Ctrl+Enter = Checkout
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        // Find and click the checkout button
        const checkoutBtn = document.querySelector(
          'button[data-pos-checkout="true"]',
        ) as HTMLButtonElement | null;
        if (checkoutBtn && !checkoutBtn.disabled) {
          checkoutBtn.click();
        }
      }
      // Escape intentionally does nothing here: Radix dialogs close it
      // themselves, and no custom selection-clearing is wired.
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <PageShell fixed className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest text-muted">
            {t("boot.activating")}
          </p>
        </div>
      </PageShell>
    );
  }

  // A dead catalogue means the till has nothing to sell, so block rather than
  // present an empty grid the cashier could mistake for a stocked-but-quiet day.
  if (catalogError) {
    return (
      <PageShell fixed className="flex h-[60vh] items-center justify-center">
        <div className="w-full p-4">
          <ErrorState
            title={t("boot.load_failed_title")}
            message={catalogError}
            onRetry={() => window.location.reload()}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell fixed>
      {/* Success Overlay & Modals */}
      <SuccessOverlay />
      <ManagerApprovalModal />

      <POSHeader
        isOffline={isOffline}
        pendingCount={pendingCount}
        onSaleStarted={() => setMobileView("items")}
      />

      {/* Load failures that must not be mistaken for "nothing to do". */}
      {(shiftError || readyAppointmentsError) && (
        <div className="px-2 lg:px-0">
          <InlineNotice tone="error">
            {shiftError ?? readyAppointmentsError}
          </InlineNotice>
        </div>
      )}

      {/* Offline banner: queued invoices + auto-replay on reconnect. */}
      {(isOffline || pendingCount > 0) && (
        <div className="px-2 lg:px-0">
          <InlineNotice tone="warning">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="flex min-w-0 items-start gap-2">
                <WifiOff size={16} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  {isOffline
                    ? t("offline.offline")
                    : t("offline.pending", { count: pendingCount })}
                </span>
              </span>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => void replay()}
                  disabled={replaying || isOffline}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-warning/30 bg-soft px-3 text-[11px] font-black transition-all hover:bg-soft/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {replaying ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <UploadCloud size={13} />
                  )}
                  {t("offline.send_now")}
                </button>
              )}
            </div>
          </InlineNotice>
        </div>
      )}

      {/* Desktop: sessions | catalogue | cart. On lg (900px–1279px) we show 2
          columns so the checkout CTA is never clipped; on xl (≥1280px) we show
          all 3. Mobile: one panel at a time via bottom nav. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden px-2 pb-2 lg:grid-cols-[1fr_1.3fr] lg:px-0 lg:pb-0 xl:grid-cols-[minmax(18rem,0.9fr)_minmax(28rem,2.1fr)_minmax(21rem,1.3fr)]">
        {/* Right column: the reception queue, shown only on xl desktop. */}
        <aside
          aria-label={t("sessions.title")}
          className={cn(
            "min-h-0 overflow-hidden",
            "hidden xl:block",
            mobileView !== "ops" && "hidden",
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/60 bg-card p-3 shadow-sm">
            <SessionsQueue />
          </Card>
        </aside>

        {/* Middle column: start panel when idle, catalogue during a sale. */}
        <section
          className={cn(
            "min-h-0 overflow-hidden",
            mobileView !== "items" && "hidden lg:block",
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/60 bg-card p-3 shadow-sm">
            {saleMode === "idle" ? <POSStartPanel /> : <ItemSelection />}
          </Card>
        </section>

        {/* Left column: buyer, cart, payment. */}
        <aside
          aria-label={t("cart.title")}
          className={cn(
            "min-h-0 overflow-hidden",
            mobileView !== "cart" && "hidden lg:block",
          )}
        >
          <CheckoutBar />
        </aside>
      </div>

      {/* Mobile Bottom Navigation (POS-specific 3-tab) */}
      <POSBottomNav
        activeView={mobileView}
        setActiveView={setMobileView}
        cartLength={cart.length}
        readyAppointmentsLength={readyAppointments.length}
      />
    </PageShell>
  );
};

export default function POS() {
  return (
    <POSProvider>
      <POSLayout />
    </POSProvider>
  );
}
