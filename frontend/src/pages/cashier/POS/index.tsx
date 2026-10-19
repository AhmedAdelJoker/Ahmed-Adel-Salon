import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { POSProvider, usePOS } from "@/pages/cashier/POS/POSContext";
import { appointmentToCartItems } from "@/features/pos";
import ShiftSidebar from "@/pages/cashier/POS/components/ShiftSidebar";
import SessionsQueue from "@/pages/cashier/POS/components/SessionsQueue";
import ItemSelection from "@/pages/cashier/POS/components/ItemSelection";
import CheckoutBar from "@/pages/cashier/POS/components/CheckoutBar";
import SuccessOverlay from "@/pages/cashier/POS/components/SuccessOverlay";
import POSBottomNav from "@/pages/cashier/POS/components/POSBottomNav";
import { Grid, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, RefreshCw } from "lucide-react";
import { ErrorState } from "@/components/shared/AsyncState";
import InlineNotice from "@/components/shared/InlineNotice";
import { PageShell } from "@/components/shared/PageShell";
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
  const {
    loading,
    readyAppointments,
    activeInvoiceId,
    activeAppointmentId,
    cart,
    shiftError,
    readyAppointmentsError,
    catalogError,
    barbers,
    setCart,
    setActiveAppointmentId,
    setSelectedCustomerId,
    setSelectedBarberId,
    setIsReviewing,
  } = usePOS();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("sessions"); // "sessions" or "items"
  const [mobileView, setMobileView] = useState("ops"); // "ops" (Shift/Sessions), "items", "cart"

  // Which middle-column panel exists where. On mobile `mobileView` picks one
  // panel; on desktop (where mobileView never leaves "ops") `activeTab`
  // switches between them, so exactly one renders for every viewport.
  const showSessions = activeTab === "sessions" && mobileView !== "items";
  const showItems = activeTab === "items" || mobileView === "items";

  const handoff = (location.state ?? null) as BookingHandoffState | null;
  const handoffBookingId = handoff?.bookingId ?? null;

  // Consume the `/bookings` handoff once the catalogue has loaded (the barber
  // list arrives in phase 1), then clear the navigation state so a browser
  // refresh does not re-apply it.
  useEffect(() => {
    if (loading || !handoffBookingId) return;
    setCart(
      appointmentToCartItems(
        {
          id: handoffBookingId,
          barber_id: handoff?.barberId ?? "",
          services: handoff?.services ?? [],
        },
        barbers,
      ),
    );
    setActiveAppointmentId(handoffBookingId);
    setSelectedCustomerId(
      handoff?.customerId ? String(handoff.customerId) : "walk_in",
    );
    if (handoff?.barberId) setSelectedBarberId(String(handoff.barberId));
    setIsReviewing(true);
    const serviceCount = (handoff?.services ?? []).length;
    if (serviceCount > 0) {
      toast.success("تم تحميل الحجز في نقطة البيع للمراجعة");
    } else {
      toast(
        "الحجز محمّل في نقطة البيع، لكنه لا يحتوي خدمات — أضف البنود يدوياً",
        { icon: "⚠️" },
      );
    }
    // The cart view is where the prepared session is reviewed, on mobile.
    setMobileView("cart");
    navigate("/pos", { replace: true, state: null });
  }, [loading, handoffBookingId, handoff, barbers, navigate, setCart, setActiveAppointmentId, setSelectedCustomerId, setSelectedBarberId, setIsReviewing]);

  // Global keyboard shortcut: Ctrl+Enter = Checkout
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        // Find and click the checkout button
        const checkoutBtn = document.querySelector(
          'button[data-pos-checkout="true"]',
        ) as HTMLButtonElement | null;
        if (checkoutBtn && !checkoutBtn.disabled) {
          checkoutBtn.click();
        }
      }
      if (e.key === "Escape") {
        // Escape clears selection / closes modals
        // Could trigger resetPOS or close modals
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (loading) {
    return (
      <PageShell fixed className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p className="text-sm font-bold tracking-widest text-muted uppercase">
            تنشيط محطة الـ POS الآمنة...
          </p>
        </div>
      </PageShell>
    );
  }

  // A dead catalogue means the till has nothing to sell, so block rather than
  // present an empty grid the cashier could mistake for a stocked-but-quiet day.
  if (catalogError) {
    return (
      <PageShell fixed className="h-[60vh] flex items-center justify-center">
        <div className="w-full p-4">
          <ErrorState
            title="تعذر تحميل محطة نقطة البيع"
            message={catalogError}
            onRetry={() => window.location.reload()}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell fixed className="max-h-[calc(100vh-80px)]">
      {/* Success Overlay & Modals */}
      <SuccessOverlay />

      {/* Load failures that must not be mistaken for "nothing to do". */}
      {(shiftError || readyAppointmentsError) && (
        <div className="px-2 lg:px-0">
          <InlineNotice tone="error">
            {shiftError ?? readyAppointmentsError}
          </InlineNotice>
        </div>
      )}

      {/* Edit Mode Badge - Fixed at top */}
      {activeInvoiceId && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60]">
          <Badge
            variant="warning"
            size="lg"
            className="shadow-premium px-4 py-1.5 flex gap-2 items-center text-xs"
          >
            <ShieldCheck size={14} /> نمط التعديل نشط: الفاتورة #
            {activeInvoiceId}
          </Badge>
        </div>
      )}

      {/* Desktop Layout (Grid) / Mobile Layout (Conditional Rendering) */}
      {/* Extra mobile clearance: the shell covers the global pill nav, this
          page's own bottom bar needs ~16px more. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.5fr] xl:grid-cols-[1.2fr_2.5fr_1.8fr] gap-4 flex-1 min-h-0 overflow-hidden px-2 lg:px-0 pb-4 lg:pb-0">
        {/* Right Column: Shift & Quick Stats (Always on Desktop, Tabbed on Mobile) */}
        <div
          className={cn(
            "flex flex-col gap-4 overflow-y-auto no-scrollbar pb-4",
            mobileView !== "ops" && "hidden lg:flex",
          )}
        >
          <ShiftSidebar />
        </div>

        {/* Middle Column: Selection Area (Always on Desktop, Tabbed on Mobile) */}
        <Card
          className={cn(
            "flex flex-col gap-4 overflow-hidden p-4 sm:p-6 shadow-sm border-border/50",
            // Hidden on mobile only while the cart owns the screen; on desktop
            // the three-column grid shows every column regardless.
            mobileView === "cart" && "hidden lg:flex",
          )}
        >
          {/* Tab Switcher - Only visible on Desktop or when needed */}
          <div className="hidden lg:flex items-center gap-2 p-1 bg-soft/50 rounded-xl self-center border border-border/40">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === "sessions"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm"
                  : "text-muted hover:text-main"
              }`}
            >
              <Clock size={16} />
              <span>الجلسات من الاستقبال</span>
              <Badge
                variant={activeTab === "sessions" ? "primary" : "outline"}
                size="sm"
                className="rounded-full px-1.5 min-w-[20px] justify-center"
              >
                {readyAppointments.length}
              </Badge>
            </button>
            <button
              onClick={() => {
                if (!activeAppointmentId) {
                  toast.error("يرجى اختيار جلسة أولاً لإضافة خدمات إضافية");
                  return;
                }
                setActiveTab("items");
              }}
              className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
                activeTab === "items"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm"
                  : activeAppointmentId
                    ? "text-muted hover:text-main"
                    : "opacity-40 cursor-not-allowed"
              }`}
            >
              <Grid size={16} />
              <span>إضافة خدمات إضافية</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {/* Logic for what to show in middle column based on desktop tabs or mobile view */}
            <div className="h-full">
              <div
                className={cn(
                  "h-full",
                  showSessions ? "block" : "hidden lg:block",
                )}
              >
                {showSessions && <SessionsQueue />}
              </div>
              <div
                className={cn(
                  "h-full",
                  showItems ? "block" : "hidden",
                )}
              >
                {activeAppointmentId ? (
                  <ItemSelection />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                    <Clock size={48} className="text-primary mb-4" />
                    <h3 className="text-base font-black text-main">
                      بانتظار اختيار جلسة
                    </h3>
                    <p className="text-xs font-bold text-muted mt-2">
                      يرجى اختيار جلسة من قائمة الاستقبال للبدء.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Left Column: Cart & Checkout (Always on Desktop, Tabbed on Mobile) */}
        <div
          className={cn(
            "flex flex-col gap-4 min-h-0 overflow-hidden",
            mobileView !== "cart" && "hidden lg:flex",
          )}
        >
          <CheckoutBar />
        </div>
      </div>

      {/* Mobile Bottom Navigation (POS-specific 3-tab) */}
      <POSBottomNav
        activeView={mobileView}
        setActiveView={setMobileView}
        activeAppointmentId={activeAppointmentId}
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
