import React from "react";
import { Grid, Clock, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { id: "ops", icon: Clock, label: "الجلسات", badge: "sessions" },
  {
    id: "items",
    icon: Grid,
    label: "إضافة",
    badge: "items",
    disabledCheck: "noAppointment",
  },
  { id: "cart", icon: Zap, label: "السلة", badge: "cart" },
];

interface POSBottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
  activeAppointmentId?: string | number | null;
  cartLength: number;
  readyAppointmentsLength: number;
}

const POSBottomNav = ({
  activeView,
  setActiveView,
  activeAppointmentId,
  cartLength,
  readyAppointmentsLength,
}: POSBottomNavProps) => {
  const handleTabClick = (tabId) => {
    if (tabId === "items" && !activeAppointmentId) {
      return; // Disabled - handled by visual state
    }
    setActiveView(tabId);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.nav
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 lg:hidden mobile-bottom-safe"
        dir="rtl"
        role="tablist"
        aria-label="تنقل نقطة البيع"
      >
        <div className="mx-auto max-w-xl">
          <div className="rounded-t-[2rem] bg-card/95 backdrop-blur-xl border border-border shadow-premium overflow-hidden">
            <div className="grid grid-cols-3 gap-1 p-1.5">
              {TABS.map((tab) => {
                const isActive = activeView === tab.id;
                const Icon = tab.icon;
                const showBadge =
                  tab.badge === "sessions"
                    ? readyAppointmentsLength > 0
                    : tab.badge === "cart"
                      ? cartLength > 0
                      : false;
                const badgeCount =
                  tab.badge === "sessions"
                    ? readyAppointmentsLength
                    : tab.badge === "cart"
                      ? cartLength
                      : 0;
                const isDisabled =
                  tab.disabledCheck === "noAppointment" && !activeAppointmentId;

                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-disabled={isDisabled}
                    aria-label={tab.label}
                    onClick={() => handleTabClick(tab.id)}
                    disabled={isDisabled}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 transition-all duration-300 touch-target",
                      isActive
                        ? "bg-primary-soft text-primary"
                        : isDisabled
                          ? "text-muted/40 opacity-60"
                          : "text-muted hover:bg-soft hover:text-main",
                    )}
                    style={{ minHeight: "56px" }}
                  >
                    <Icon
                      size={isActive ? 22 : 20}
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden="true"
                    />
                    <span className="text-[10px] font-black leading-none">
                      {tab.label}
                    </span>
                    {showBadge && (
                      <Badge
                        variant={isActive ? "primary" : "outline"}
                        className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1.5 text-[9px] font-black"
                      >
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </Badge>
                    )}
                    {isActive && (
                      <motion.div
                        layout
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-primary rounded-full"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.nav>
    </AnimatePresence>
  );
};

export default POSBottomNav;
