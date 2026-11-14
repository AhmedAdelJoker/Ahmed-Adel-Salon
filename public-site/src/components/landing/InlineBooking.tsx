/**
 * InlineBooking — the three-field picker in the hero.
 *
 * The hero's right column used to be an information card: two counts, a phone
 * number, an address. It is now the only place on the page where a visitor can
 * start a booking without navigating, which is the entire reason the redesign
 * was worth doing — a salon loses most of its traffic the moment the visitor has
 * to *decide* to go somewhere else.
 *
 * Two rules govern what it may claim:
 *
 * 1. **It never fabricates availability.** `slots` comes from the caller, which
 *    gets it from real availability data. If there are no slots, this renders
 *    nothing at all rather than a grid of plausible times.
 * 2. **It never claims a booking was made.** The final action hands the visitor
 *    to the real booking flow (or WhatsApp) carrying their selections. A widget
 *    that posts a success toast without a server round-trip is a widget that
 *    will lie to someone.
 */

import { useState } from "react";
import { CalendarCheck2, Check } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";
import type { Translate } from "./Hero";

export interface InlineBookingProps {
  theme: BrandTheme;
  t: Translate;
  services: { id: string; name: string; price: number; duration?: string }[];
  barbers: { id: string; name: string }[];
  slots: string[];
  currency: string;
  /** Final action. Receives the visitor's three choices. */
  onConfirm: (choice: {
    serviceId: string;
    serviceName: string;
    barberId?: string;
    barberName?: string;
    slot: string;
    price: number;
  }) => void;
}

export default function InlineBooking({
  theme,
  t,
  services,
  barbers,
  slots,
  currency,
  onConfirm,
}: InlineBookingProps) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [slot, setSlot] = useState(slots[0] ?? "");

  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const barber = barbers.find((b) => b.id === barberId);

  return (
    <div
      className="w-full rounded-[var(--r-xl)] border border-[color:var(--c-border-strong)] p-6 backdrop-blur-xl sm:p-7"
      // A solid card, not `rgba(…, 0.55)` over the photograph: the old panel was
      // translucent, and a form you have to read through a moving hero video is
      // a form nobody fills in.
      style={{ backgroundColor: theme.card }}
    >
      <p
        className="text-[length:var(--step--1)] font-semibold uppercase text-[color:var(--c-faint)]"
        style={{ letterSpacing: "var(--tracking-eyebrow)" }}
      >
        {t("landing.inlineBookingTitle")}
      </p>

      {/* Step 1 — service. */}
      <Field label={t("landing.inlineBookingService")} htmlFor="hero-booking-service">
        <select
          id="hero-booking-service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full rounded-[var(--r-md)] border border-[color:var(--c-border-strong)] bg-[color:var(--c-inset)] px-4 py-3.5 text-[length:var(--step-0)] font-semibold text-[color:var(--c-text)]"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.price} {currency}
            </option>
          ))}
        </select>
      </Field>

      {/* Step 2 — stylist. Optional: the salon may not offer the choice. */}
      {barbers.length > 0 ? (
        <Field label={t("landing.inlineBookingBarber")} htmlFor="hero-booking-barber">
          <select
            id="hero-booking-barber"
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="w-full rounded-[var(--r-md)] border border-[color:var(--c-border-strong)] bg-[color:var(--c-inset)] px-4 py-3.5 text-[length:var(--step-0)] font-semibold text-[color:var(--c-text)]"
          >
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {/* Step 3 — time. Buttons, not a select: the whole point of showing real
          slots is that they can be read at a glance and compared. */}
      <Field label={t("landing.inlineBookingSlot")}>
        <div
          role="group"
          aria-label={t("landing.inlineBookingSlot")}
          className="grid grid-cols-3 gap-2"
        >
          {slots.map((time) => (
            <button
              key={time}
              type="button"
              aria-pressed={slot === time}
              onClick={() => setSlot(time)}
              className="numeric rounded-[var(--r-md)] border px-2 py-3 text-[length:var(--step--1)] font-bold transition"
              style={
                slot === time
                  ? {
                      backgroundColor: theme.accent,
                      borderColor: theme.accent,
                      color: "#0b0b0d",
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

      {/* The running summary. Without it the visitor picks three things and
          cannot see what they just picked — which is how a form turns into a
          guessing game at the last step. */}
      {service ? (
        <dl
          className="mt-5 grid gap-1.5 rounded-[var(--r-md)] border border-[color:var(--c-border)] p-4 text-[length:var(--step--1)]"
          style={{ backgroundColor: theme.inset }}
        >
          <Row label={t("landing.inlineBookingService")} value={service.name} />
          {barber ? (
            <Row label={t("landing.inlineBookingBarber")} value={barber.name} />
          ) : null}
          <Row
            label={t("landing.inlineBookingSlot")}
            value={slot}
            mono
          />
          <Row
            label={t("landing.inlineBookingTotal")}
            value={`${service.price} ${currency}${service.duration ? ` · ${service.duration} ${t("common.minutes")}` : ""}`}
            mono
          />
        </dl>
      ) : null}

      <button
        type="button"
        disabled={!service || !slot}
        onClick={() =>
          service &&
          onConfirm({
            serviceId: service.id,
            serviceName: service.name,
            barberId: barber?.id,
            barberName: barber?.name,
            slot,
            price: service.price,
          })
        }
        className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full text-[length:var(--step-0)] font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: theme.accent, color: "#0b0b0d" }}
      >
        <CalendarCheck2 size={19} aria-hidden="true" />
        {t("landing.inlineBookingConfirm")}
      </button>
    </div>
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
    <div className="mt-5">
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-[length:var(--step--2)] font-semibold uppercase text-[color:var(--c-muted)]"
        style={{ letterSpacing: "var(--tracking-eyebrow)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[color:var(--c-muted)]">{label}</dt>
      <dd
        className={`text-end font-bold text-[color:var(--c-text)]${mono ? " numeric" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export { Check };