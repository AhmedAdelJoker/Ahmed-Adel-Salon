import React, { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePOS } from "@/pages/cashier/POS/POSContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChevronLeft,
  Clock,
  RefreshCw,
  ShoppingBag,
  User,
  Zap,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/core/utils";
import { useIntlLocale } from "@/hooks/useAppLocale";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";

const ESTIMATED_ITEM_HEIGHT = 152; // First guess; each card is measured after it renders.

/**
 * The reception queue — the normal starting point for a POS sale.
 *
 * Clicking a card loads the whole session (services, barber, customer) through
 * the one `loadSession` action in the POS feature. The card used to assemble
 * that cart itself, which is why this path and the `/bookings` handoff could
 * drift apart on field spellings.
 */
const SessionsQueue = () => {
  const { t } = useTranslation("pos");
  const {
    readyAppointments,
    readyAppointmentsLoading,
    fetchReadyAppointments,
    loadSession,
    activeAppointmentId,
  } = usePOS();

  const parentRef = useRef<HTMLDivElement | null>(null);

  const handleLoadAppointment = useCallback(
    (appointment) => {
      loadSession(appointment);
    },
    [loadSession],
  );

  // Virtualizer for large lists
  const virtualizer = useVirtualizer({
    count: readyAppointments.length,
    getScrollElement: () => parentRef.current,
    // Only the first estimate. The real height is measured per card (see
    // `virtualizer.measureElement` below) because a session card's height
    // depends on how many services it lists — a fixed estimate made the
    // cards overlap the next one, or left gaps, as soon as the list held
    // anything other than average-length cards.
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-black text-main">
            <Clock className="text-primary" size={16} aria-hidden="true" />
            {t("sessions.title")}
            <Badge
              variant="primary"
              size="sm"
              className="min-w-5 justify-center rounded-full tabular-nums"
            >
              {readyAppointments.length}
            </Badge>
          </h2>
          <p className="mt-0.5 text-[10px] font-bold text-muted">
            {t("sessions.subtitle")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReadyAppointments}
          disabled={readyAppointmentsLoading}
          className="h-9 w-9 rounded-lg p-0 touch-target"
          aria-label={t("sessions.refresh")}
        >
          <RefreshCw
            size={15}
            className={readyAppointmentsLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <AnimatePresence>
          {readyAppointments.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex h-full flex-col items-center justify-center px-3 text-center opacity-60"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft">
                <ShoppingBag
                  size={24}
                  className="text-muted"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-xs font-black text-muted">
                {t("sessions.empty")}
              </h3>
              <p className="mt-1 max-w-[14rem] text-[10px] font-bold leading-relaxed text-muted/80">
                {t("sessions.empty_hint")}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="sessions"
              ref={parentRef}
              className="h-full overflow-y-auto no-scrollbar touch-action-pan-y"
              style={{ contain: "layout paint" }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => (
                  // The positioning lives on a plain wrapper, NOT on the
                  // motion.div: framer-motion owns the `transform` style
                  // property, so the virtualizer's translateY was being
                  // overwritten by the enter animation. The wrapper also
                  // carries the measurement ref and index that
                  // `virtualizer.measureElement` needs.
                  <div
                    key={
                      readyAppointments[virtualRow.index]?.appointment_id ||
                      readyAppointments[virtualRow.index]?.id
                    }
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      // Capped: the old `index * 0.02` delay reached a full
                      // second by the 50th card, so a long queue visibly
                      // filled in one card at a time.
                      transition={{
                        delay: Math.min(virtualRow.index, 8) * 0.02,
                      }}
                    >
                      <SessionCard
                        appt={readyAppointments[virtualRow.index]}
                        activeAppointmentId={activeAppointmentId}
                        handleLoadAppointment={handleLoadAppointment}
                      />
                    </motion.div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Separate SessionCard component for better memoization
const SessionCard = React.memo(
  ({
    appt,
    activeAppointmentId,
    handleLoadAppointment,
  }: {
    appt: any;
    activeAppointmentId: string | number | null;
    handleLoadAppointment: (appointment: any) => void;
  }) => {
    const { t } = useTranslation("pos");
    const locale = useIntlLocale();
    const appointmentId = appt?.appointment_id || appt?.id;
    const isActive = String(activeAppointmentId) === String(appointmentId);

    return (
      <Card
        className={cn(
          "group relative mb-2 cursor-pointer overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
          isActive
            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
            : "border-border/60 hover:border-primary/30 hover:shadow-md",
        )}
        onClick={() => handleLoadAppointment(appt)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleLoadAppointment(appt);
          }
        }}
        tabIndex={0}
        role="button"
        aria-pressed={isActive}
        aria-label={t("sessions.aria", {
          name: appt.customer_name || t("sessions.unknown_customer"),
          time: appt.appointment_time || t("sessions.no_time"),
          total: formatCurrency(
            appt.total_estimated_price ?? appt.total_amount ?? 0,
          ),
        })}
      >
        {isActive && (
          <div className="absolute inset-y-0 end-0 w-1 bg-primary" />
        )}

        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soft text-primary transition-transform group-hover:scale-105">
                <User size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-xs font-black leading-tight text-main">
                  {appt.customer_name || t("sessions.unknown_customer")}
                </h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" size="sm" className="tabular-nums">
                    #{appointmentId}
                  </Badge>
                  <span className="flex items-center gap-1 rounded bg-soft px-1 py-0.5 text-[9px] font-bold text-muted">
                    <Clock size={8} aria-hidden="true" />
                    {(() => {
                      const timeStr = appt.appointment_time;
                      if (!timeStr) return "--:--";
                      const [h, m] = timeStr.split(":");
                      const date = new Date();
                      date.setHours(parseInt(h), parseInt(m), 0);
                      return date.toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      });
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-1.5 py-0.5">
              <Zap
                size={9}
                className="shrink-0 text-primary"
                aria-hidden="true"
              />
              <span className="truncate text-[9px] font-black text-primary">
                {appt.employee_name ||
                  appt.barber_name ||
                  t("sessions.no_expert")}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="rounded-lg border border-border/50 bg-card px-2 py-1 shadow-sm">
              <p className="text-xs font-black tabular-nums text-primary">
                {formatCurrency(
                  appt.total_estimated_price ?? appt.total_amount ?? 0,
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5 text-[9px] font-black text-primary opacity-0 transition-all group-hover:opacity-100">
              {t("sessions.review")}
              <ChevronLeft size={9} strokeWidth={3} aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-2 flex flex-wrap gap-1">
          {(appt.services || []).map((service, index) => (
            <span
              key={index}
              className="max-w-[8rem] truncate rounded border border-border/50 bg-soft px-1.5 py-0.5 text-[9px] font-black text-muted transition-colors group-hover:border-primary/20"
            >
              {service.service_name_snapshot ||
                service.service_name ||
                service.name}
            </span>
          ))}
        </div>
      </Card>
    );
  },
);

SessionCard.displayName = "SessionCard";

export default SessionsQueue;
