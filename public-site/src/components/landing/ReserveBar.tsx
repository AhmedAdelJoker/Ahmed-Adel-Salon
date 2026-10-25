/**
 * ReserveBar.tsx — the thin booking strip under the hero.
 *
 * ## Why this replaced the booking card
 *
 * The previous hero put a full booking form in the right column: three
 * labelled fields, a step indicator, a summary table and a confirm button.
 * That is the correct control *after* the visitor has decided to book, and the
 * wrong thing to show before they have read a single line about the salon. It
 * also made the hero two thirds form on a laptop.
 *
 * This bar keeps the useful part — service, stylist, time — at one row and
 * roughly 80px tall, and hands the selection to the real booking flow, which
 * still owns availability and the confirmation.
 *
 * ## What it does not do
 *
 * It does not claim a slot. The times are suggestions generated from the
 * salon's own hours, not checked against the appointment book, so the confirm
 * action navigates with the selection and the booking page re-checks. A
 * widget that prints "تم الحجز" without a server round-trip is a widget that
 * will eventually lie.
 */

import { CalendarCheck2 } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface ReserveChoice {
  serviceId: string;
  serviceName: string;
  barberId?: string;
  barberName?: string;
  slot: string;
  price: number;
}

export interface ReserveBarProps {
  theme: BrandTheme;
  t: Translate;
  services: { id: string; name: string; price: number; duration?: string }[];
  barbers: { id: string; name: string }[];
  slots: string[];
  serviceId: string;
  barberId: string;
  slot: string;
  onServiceChange: (id: string) => void;
  onBarberChange: (id: string) => void;
  onSlotChange: (slot: string) => void;
  onConfirm: () => void;
}

export default function ReserveBar({
  theme,
  t,
  services,
  barbers,
  slots,
  serviceId,
  barberId,
  slot,
  onServiceChange,
  onBarberChange,
  onSlotChange,
  onConfirm,
}: ReserveBarProps) {
  if (services.length === 0) return null;

  return (
    <div>
      <div
        className="mk-reserve"
        role="group"
        aria-label={t("landing.reserveTitle")}
        style={{ borderColor: theme.borderStrong, backgroundColor: theme.card }}
      >
        <div className="mk-reserve-field">
          <label htmlFor="reserve-service">{t("landing.inlineBookingService")}</label>
          <select
            id="reserve-service"
            value={serviceId}
            onChange={(event) => onServiceChange(event.target.value)}
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>

        {barbers.length > 0 ? (
          <div className="mk-reserve-field">
            <label htmlFor="reserve-barber">{t("landing.inlineBookingBarber")}</label>
            <select
              id="reserve-barber"
              value={barberId}
              onChange={(event) => onBarberChange(event.target.value)}
            >
              <option value="">{t("landing.inlineBookingAnyBarber")}</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {slots.length > 0 ? (
          <div className="mk-reserve-field">
            <label htmlFor="reserve-slot">{t("landing.inlineBookingSlot")}</label>
            <select
              id="reserve-slot"
              className="numeric"
              value={slot}
              onChange={(event) => onSlotChange(event.target.value)}
            >
              {slots.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mk-reserve-cta">
          <button
            type="button"
            onClick={onConfirm}
            className="mk-btn mk-btn-primary mk-btn-lg"
            style={{ backgroundColor: theme.accent, color: theme.onAccent }}
          >
            <CalendarCheck2 size={18} aria-hidden="true" />
            {/* Same label as the inline booking step: the hero button directly
                above already says "book", and two identical CTAs in one
                viewport make the second one look like a different action. */}
            {t("landing.inlineBookingConfirm")}
          </button>
        </div>
      </div>

      <p
        className="mt-3 text-[length:var(--step--2)] font-semibold"
        style={{ color: theme.faint }}
      >
        {t("landing.reserveNote")}
      </p>
    </div>
  );
}
