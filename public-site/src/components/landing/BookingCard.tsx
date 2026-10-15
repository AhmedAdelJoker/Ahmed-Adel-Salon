/**
 * BookingCard — the hero's right column.
 *
 * The single conversion point on the page, and the reason the redesign is worth
 * doing: a visitor who can pick a service, a stylist and a time without leaving
 * the page has already booked. A salon loses most of its traffic at the moment
 * it asks a first-time visitor to navigate.
 *
 * Two rules govern what it may claim:
 *
 * 1. **It never fabricates availability.** `slots` comes from the caller, which
 *    gets it from real availability data. No slots means the card renders its
 *    "ask for a time" state rather than a grid of plausible times.
 * 2. **It never claims a booking was made.** The final action hands the visitor
 *    to the real booking flow carrying their selections. A widget that posts a
 *    success toast without a server round-trip is a widget that will lie to
 *    someone.
 *
 * The three steps are a progress indicator, not a wizard: every field is present
 * from the start, and the numbers track what has been chosen rather than gating
 * what can be touched. A visitor who knows they want a specific stylist should
 * not have to click twice to reach it.
 */

import { CalendarCheck2 } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";
import type { Translate } from "./Hero";

export interface BookingCardProps {
  theme: BrandTheme;
  t: Translate;
  services: { id: string; name: string; price: number; duration?: string }[];
  barbers: { id: string; name: string }[];
  slots: string[];
  currency: string;
  /** Which of the three fields last changed, for the step indicator. */
  step: 1 | 2 | 3;
  serviceId: string;
  barberId: string;
  slot: string;
  onServiceChange: (id: string) => void;
  onBarberChange: (id: string) => void;
  onSlotChange: (slot: string) => void;
  onConfirm: () => void;
  /** Hand the visitor to the full booking flow. */
  onFullBooking: () => void;
}

export default function BookingCard({
  theme,
  t,
  services,
  barbers,
  slots,
  currency,
  step,
  serviceId,
  barberId,
  slot,
  onServiceChange,
  onBarberChange,
  onSlotChange,
  onConfirm,
  onFullBooking,
}: BookingCardProps) {
  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const barber = barbers.find((b) => b.id === barberId);

  return (
    <aside
      className="mk-bookcard"
      aria-labelledby="mk-booking-title"
      style={{ backgroundColor: theme.card, borderColor: theme.borderStrong }}
    >
      <h3 id="mk-booking-title" className="text-[length:var(--step-0)] font-bold">
        {t("landing.inlineBookingTitle")}
      </h3>

      {/* Progress. `aria-hidden` because the fields below carry the state: a
          screen reader announcing "step 1 of 3" and then reading the same
          content again is noise, not orientation. */}
      <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
        {(
          [
            [1, t("landing.inlineBookingService")],
            [2, t("landing.inlineBookingBarber")],
            [3, t("landing.inlineBookingSlot")],
          ] as const
        ).map(([n, label]) => (
          <div
            key={n}
            className={`flex items-center gap-1.5 text-[0.78rem] font-bold ${
              step === n ? "text-[color:var(--c-accent-2)]" : "text-[color:var(--c-faint)]"
            }`}
          >
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full border"
              style={
                step === n
                  ? { backgroundColor: theme.accent, borderColor: theme.accent, color: theme.onAccent }
                  : { backgroundColor: theme.inset, borderColor: theme.borderStrong }
              }
            >
              {n}
            </span>
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>

      {services.length > 0 ? (
        <div className="mt-5 grid gap-3">
          <Field label={t("landing.inlineBookingService")} htmlFor="mk-booking-service">
            <select
              id="mk-booking-service"
              value={serviceId}
              onChange={(e) => onServiceChange(e.target.value)}
              className="w-full rounded-[var(--r-md)] border border-[color:var(--c-border-strong)] px-4 py-3.5 text-[length:var(--step-0)] font-semibold text-[color:var(--c-text)]"
              style={{ backgroundColor: theme.inset }}
              onFocus={() => onServiceChange(serviceId)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          {/* Optional: the salon may not offer a choice of stylist, and a
              disabled dropdown for that is worse than none. */}
          {barbers.length > 0 ? (
            <Field label={t("landing.inlineBookingBarber")} htmlFor="mk-booking-barber">
              <select
                id="mk-booking-barber"
                value={barberId}
                onChange={(e) => onBarberChange(e.target.value)}
                className="w-full rounded-[var(--r-md)] border border-[color:var(--c-border-strong)] px-4 py-3.5 text-[length:var(--step-0)] font-semibold text-[color:var(--c-text)]"
                style={{ backgroundColor: theme.inset }}
              >
                <option value="">{t("landing.inlineBookingAnyBarber")}</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {slots.length > 0 ? (
            <Field label={t("landing.inlineBookingSlot")}>
              <div role="group" aria-label={t("landing.inlineBookingSlot")} className="grid grid-cols-3 gap-2">
                {slots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    aria-pressed={slot === time}
                    onClick={() => onSlotChange(time)}
                    className="numeric rounded-[var(--r-md)] border px-2 py-3 text-[length:var(--step--1)] font-bold transition"
                    style={
                      slot === time
                        ? {
                            backgroundColor: theme.accent,
                            borderColor: theme.accent,
                            color: theme.onAccent,
                          }
                        : {
                            backgroundColor: theme.inset,
                            borderColor: theme.borderStrong,
                            color: theme.text,
                          }
                    }
                  >
                    {time}
                  </button>
                ))}
              </div>
            </Field>
          ) : null}

          {service ? (
            <dl
              className="mt-4 grid gap-1.5 rounded-[var(--r-md)] border p-4 text-[length:var(--step--1)]"
              style={{ backgroundColor: theme.inset, borderColor: theme.border }}
            >
              <Row label={t("landing.inlineBookingService")} value={service.name} />
              {barber ? (
                <Row label={t("landing.inlineBookingBarber")} value={barber.name} />
              ) : null}
              {slot ? <Row label={t("landing.inlineBookingSlot")} value={slot} mono /> : null}
              <Row
                label={t("landing.inlineBookingTotal")}
                value={`${service.price} ${currency}${
                  service.duration ? ` · ${service.duration} ${t("common.minutes")}` : ""
                }`}
                mono
              />
            </dl>
          ) : null}

          <button
            type="button"
            disabled={!service || slots.length === 0}
            onClick={onConfirm}
            className="mk-btn mk-btn-primary mk-btn-lg disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: theme.accent, color: theme.onAccent }}
          >
            <CalendarCheck2 size={19} aria-hidden="true" />
            {t("landing.inlineBookingConfirm")}
          </button>
        </div>
      ) : (
        // No catalogue yet. A card offering an empty form is a broken widget;
        // the one action that still works is the link to the booking page.
        <div className="mt-5">
          <p className="text-[length:var(--step--1)] leading-relaxed" style={{ color: theme.muted }}>
            {t("landing.noServices")}
          </p>
          <button
            type="button"
            onClick={onFullBooking}
            className="mk-btn mk-btn-primary mk-btn-lg mt-4"
            style={{ backgroundColor: theme.accent, color: theme.onAccent }}
          >
            {t("nav.bookNow")}
          </button>
        </div>
      )}
    </aside>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-[length:var(--step--2)] font-bold uppercase text-[color:var(--c-muted)]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: "var(--c-muted)" }}>{label}</dt>
      <dd className={`text-end font-bold text-[color:var(--c-text)]${mono ? " numeric" : ""}`}>
        {value}
      </dd>
    </div>
  );
}