import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Package, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { id: "ops", icon: CalendarClock, labelKey: "sessions", badge: "sessions" },
  { id: "items", icon: Package, labelKey: "add", badge: "items" },
  { id: "cart", icon: ShoppingCart, labelKey: "cart", badge: "cart" },
];

interface POSBottomNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
  cartLength: number;
  readyAppointmentsLength: number;
}

const POSBottomNav = ({
  activeView,
  setActiveView,
  cartLength,
  readyAppointmentsLength,
}: POSBottomNavProps) => {
  const { t } = useTranslation("pos");

  return (
    <AnimatePresence>
      <motion.nav
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 lg:hidden mobile-bottom-safe"
        role="tablist"
        aria-label={t("nav.label")}
      >
        <div className="mx-auto max-w-xl">
          {/* bg-card (no backdrop-blur): the bottom bar is a persistent
              surface on the mobile till; at 95% opacity the blur was visually
              a no-op while costing compositor time every frame. */}
          <div className="overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-premium">
            <div className="grid grid-cols-3 gap-1 p-1.5">
              {TABS.map((tab) => {
                const isActive = activeView === tab.id;
                const Icon = tab.icon;
                const label = t(`nav.${tab.labelKey}`);
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
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={label}
                    onClick={() => setActiveView(tab.id)}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-colors touch-target",
                      isActive
                        ? "bg-primary/10 text-primary"
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
                      {label}
                    </span>
                    {showBadge && (
                      <Badge
                        variant={isActive ? "primary" : "outline"}
                        className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1.5 text-[10px] font-black"
                      >
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </Badge>
                    )}
                    {isActive && (
                      <motion.div
                        layout
                        className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
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
