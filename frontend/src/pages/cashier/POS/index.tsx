import React, { useState, useEffect } from "react";
import { POSProvider, usePOS } from "@/pages/cashier/POS/POSContext";
import ShiftSidebar from "@/pages/cashier/POS/components/ShiftSidebar";
import SessionsQueue from "@/pages/cashier/POS/components/SessionsQueue";
import ItemSelection from "@/pages/cashier/POS/components/ItemSelection";
import CheckoutBar from "@/pages/cashier/POS/components/CheckoutBar";
import SuccessOverlay from "@/pages/cashier/POS/components/SuccessOverlay";
import ManagerApprovalModal from "@/pages/cashier/POS/components/ManagerApprovalModal";
import POSBottomNav from "@/pages/cashier/POS/components/POSBottomNav";
import { Grid, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, RefreshCw } from "lucide-react";

const POSLayout = () => {
  const {
    loading,
    readyAppointments,
    activeInvoiceId,
    activeAppointmentId,
    cart,
  } = usePOS();
  const [activeTab, setActiveTab] = useState("sessions"); // "sessions" or "items"
  const [mobileView, setMobileView] = useState("ops"); // "ops" (Shift/Sessions), "items", "cart"

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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <RefreshCw className="h-10 w-10 animate-spin" />
          <p className="text-sm font-bold tracking-widest text-muted uppercase">
            تنشيط محطة الـ POS الآمنة...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full max-h-[calc(100vh-80px)] flex-col gap-4 relative overflow-hidden"
    >
      {/* Success Overlay & Modals */}
      <SuccessOverlay />
      <ManagerApprovalModal />

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
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.5fr] xl:grid-cols-[1.2fr_2.5fr_1.8fr] gap-4 flex-1 min-h-0 overflow-hidden px-2 lg:px-0 pb-[80px] lg:pb-0">
        {/* Right Column: Shift & Quick Stats (Always on Desktop, Tabbed on Mobile) */}
        <div
          className={cn(
            "flex flex-col gap-4 overflow-y-auto no-scrollbar pb-4",
            mobileView !== "ops" && "hidden lg:flex",
          )}
        >
          <ShiftSidebar />
          {/* On mobile, Sessions Queue is part of 'ops' view */}
          <div className="lg:hidden flex-1 min-h-0">
            <Card className="h-full p-4 overflow-hidden flex flex-col gap-4">
              <SessionsQueue />
            </Card>
          </div>
        </div>

        {/* Middle Column: Selection Area (Always on Desktop, Tabbed on Mobile) */}
        <Card
          className={cn(
            "flex flex-col gap-4 overflow-hidden p-4 sm:p-6 shadow-sm border-border/50",
            mobileView !== "items" &&
              (mobileView !== "ops" || true) &&
              "hidden lg:flex",
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
                  activeTab === "sessions" || mobileView === "ops"
                    ? "block"
                    : "hidden lg:block",
                )}
              >
                {activeTab === "sessions" && <SessionsQueue />}
              </div>
              <div
                className={cn(
                  "h-full",
                  activeTab === "items" || mobileView === "items"
                    ? "block"
                    : "hidden",
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
    </div>
  );
};

export default function POS() {
  return (
    <POSProvider>
      <POSLayout />
    </POSProvider>
  );
}
