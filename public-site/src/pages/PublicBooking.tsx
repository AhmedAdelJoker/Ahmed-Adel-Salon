import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  MapPin,
  Phone,
  Scissors,
  User,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import api from "../services/api";
import { useI18n } from "../context/I18nContext";
import { resolveTheme, applyThemeMode } from "../lib/theme";
import { useAppearance } from "../lib/useAppearance";
import {
  buildPublicBookingPath,
  buildPublicSalonPath,
  buildWhatsappUrl,
  resolvePublicSlug,
} from "../lib/publicSite";
import {
  clearBookingDraft,
  readBookingDraft,
  writeBookingDraft,
} from "../lib/bookingDraft";
import { getApiErrorMessage } from "../lib/utils";
import { resolveAssetUrl } from "../lib/imageOptimizer";
import { useSEO } from "../hooks/useSEO";
import { trackEvent } from "../components/landing/Analytics";
import { BRAND } from "../lib/site";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import BookingConfirmation, {
  type ConfirmationDetails,
} from "../components/booking/BookingConfirmation";

/**
 * The public booking flow.
 *
 * ## Why this file was rewritten rather than restyled
 *
 * It was the single worst offender in the codebase for the old design:
 *
 *  - **82 hardcoded `#D4AF37`** plus 18 `#09090B`. Every button, chip, border,
 *    ring, progress bar and summary total was gold, regardless of the salon's
 *    palette — its three `THEMES` entries existed but only supplied `bg` and
 *    `text`, so a "silver" salon still booked through a gold interface.
 *  - **Two `blur-[120px]` / `blur-[140px]` animated blobs** behind the form,
 *    re-compositing every frame.
 *  - **~100 Arabic string literals** outside the translation catalogue, so the
 *    language switcher left the page in Arabic after switching to English.
 *  - **~1400px radii** (`rounded-[3rem]`, `rounded-[4rem]`) on containers that
 *    held nothing but text.
 *  - `dir="rtl"` hardcoded on the page root, pinning the layout to Arabic and
 *    mirroring it wrongly for an English visitor.
 *
 * What replaced it: a stepped form on the palette's own tokens, an asymmetric
 * two-column layout with a sticky summary, everything routed through `t()`,
 * and a draft written to `localStorage` on every change so a refresh, a
 * backgrounded mobile tab or a dropped connection at the submit step no longer
 * costs the visitor the form they just filled in.
 */

const STEPS = [
  { id: 1, key: "booking.step.services", hintKey: "booking.step.servicesHint" },
  { id: 2, key: "booking.step.barber", hintKey: "booking.step.barberHint" },
  { id: 3, key: "booking.step.schedule", hintKey: "booking.step.scheduleHint" },
  { id: 4, key: "booking.step.details", hintKey: "booking.step.detailsHint" },
] as const;

const CONFIRMED = 5;

interface SelectedService {
  service_id: number | string;
  quantity: number;
}

interface BookingForm {
  services: SelectedService[];
  barber_id: number | string | null;
  appointment_date: string;
  appointment_time: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: BookingForm = {
  services: [],
  barber_id: null,
  appointment_date: "",
  appointment_time: "",
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  notes: "",
};

type Catalog = {
  services?: any[];
  categories?: any[];
  barbers?: any[];
  /** Offers carry `service_ids`, which is what makes `?offer=` resolvable. */
  offers?: any[];
  business?: Record<string, any>;
};

export default function PublicBooking() {
  const navigate = useNavigate();
  const { publicSlug } = useParams();
  const { t, locale, time12, price: formatPrice } = useI18n();
  const [appearance] = useAppearance();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>({});
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [category, setCategory] = useState<string>("all");

  /**
   * Everything the confirmation needs, assembled from the booking response.
   *
   * Held in state rather than recomputed from `form`, because the only fields
   * the server knows and the client cannot derive — the appointment id and its
   * customer id — arrive in the POST response. A confirmation rendered from
   * client state alone cannot offer a reference to quote on the call.
   */
  const [receipt, setReceipt] = useState<ConfirmationDetails | null>(null);

  /**
   * Deep links from the entity pages: `?service=<id>`, `?offer=<id>`,
   * `?barber=<id>`.
   *
   * `EntityPage` links a service, a barber and an offer into this flow with the
   * entity preselected. Those pages are the local-SEO surface — each service
   * gets its own indexable URL with a price in the structured data — so a
   * visitor arriving from one of them in Google should not have to find the
   * service again.
   *
   * An offer carries `service_ids`, which is what makes `?offer=` resolvable: an
   * offer is not a service, it is a bundle, so it preselects every service in
   * the bundle.
   */
  const deepLink = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      service: searchParams.get("service"),
      offer: searchParams.get("offer"),
      barber: searchParams.get("barber"),
    };
  }, []);

  /** Applied once the catalogue is loaded, since it has to resolve ids. */
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);
  const lastStep = useRef(1);

  /** Memoised: the theme, the slug guard and three memos below depend on it. */
  const business = useMemo(() => catalog.business ?? {}, [catalog.business]);

  const theme = useMemo(
    () => resolveTheme(business, appearance),
    [business, appearance],
  );

  useEffect(() => {
    applyThemeMode(theme);
  }, [theme]);

  /* ── Catalogue ──────────────────────────────────────────────────────── */

  const loadCatalog = useCallback(async () => {
    try {
      const response = await api.get("/public/booking-catalog");
      setCatalog((response.data ?? response) as Catalog);
    } catch {
      toast.error(t("booking.error.catalog"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  /* ── Deep link ──────────────────────────────────────────────────────── */

  useEffect(() => {
    if (loading || deepLinkApplied) return;
    if (!deepLink.service && !deepLink.offer && !deepLink.barber) return;

    setForm((previous) => {
      const next = { ...previous };

      if (deepLink.offer) {
        // An offer is a bundle, so it resolves to a set of services.
        const offer = (catalog.offers ?? []).find(
          (item: any) => String(item.id) === deepLink.offer,
        );
        const ids: (number | string)[] = offer?.service_ids ?? [];
        if (ids.length) {
          next.services = ids.map((id) => ({ service_id: id, quantity: 1 }));
        }
      }

      if (deepLink.service) {
        next.services = [
          ...next.services.filter(
            (service) => String(service.service_id) !== deepLink.service,
          ),
          { service_id: deepLink.service, quantity: 1 },
        ];
      }

      if (deepLink.barber) {
        const match = (catalog.barbers ?? []).find(
          (barber: any) => String(barber.id) === deepLink.barber,
        );
        if (match) next.barber_id = match.id;
      }

      return next;
    });

    // Jump past the steps the link already answered, so a `?barber=` link does
    // not make the visitor page through services they already chose.
    if (deepLink.barber) setStep(2);
    setDeepLinkApplied(true);
  }, [loading, deepLink, deepLinkApplied, catalog]);

  /* ── Funnel ─────────────────────────────────────────────────────────── */

  // `booking_started` fires once, when the catalogue is actually usable — not on
  // mount, which would count every reload and every bounce as an intent.
  useEffect(() => {
    if (loading || !catalog.services?.length) return;
    trackEvent("booking_started", {
      services: catalog.services.length,
      barbers: catalog.barbers?.length ?? 0,
    });
  }, [loading, catalog]);

  useEffect(() => {
    if (loading || step === lastStep.current) return;
    lastStep.current = step;
    trackEvent("booking_step", { step });
  }, [loading, step]);


  /**
   * A canonical-slug guard. `/book` is a legacy alias that always resolves to
   * the same catalogue, so a visitor who lands on the wrong slug is redirected
   * to the right one instead of silently viewing the wrong URL forever.
   */
  useEffect(() => {
    if (!publicSlug || !Object.keys(business).length) return;
    if (publicSlug !== resolvePublicSlug(business)) {
      navigate(buildPublicBookingPath(business), { replace: true });
    }
  }, [business, navigate, publicSlug]);

  /* ── Draft ──────────────────────────────────────────────────────────── */

  /**
   * Fetch the open slots for a date, taking the barber and services as
   * arguments rather than reading them from `form`.
   *
   * Reading them from state would mean the function changes identity on every
   * keystroke, so the draft-restore effect below could not depend on it without
   * refetching on every keypress.
   */
  const loadSlots = useCallback(
    async (
      date: string,
      barberId: number | string | null,
      services: SelectedService[],
    ) => {
      if (!date) return;
      try {
        setSlotsLoading(true);
        const response: any = await api.get("/public/time-slots", {
          params: {
            booking_date: date,
            barber_id: barberId,
            service_ids: services.map((service) => service.service_id),
          },
        });
        setSlots(response?.data?.available_slots ?? response?.available_slots ?? []);
      } catch {
        toast.error(t("booking.error.slots"));
      } finally {
        setSlotsLoading(false);
      }
    },
    [t],
  );

  /** Restored once, on first mount, before any write can overwrite it. */
  const restored = useMemo(() => {
    const draft = readBookingDraft<BookingForm>(publicSlug);
    return draft?.form ?? null;
  }, [publicSlug]);

  useEffect(() => {
    if (!restored) return;
    setForm({ ...EMPTY_FORM, ...restored });
    // A restored draft with a date already chosen needs its slots back, or the
    // visitor lands on step 3 with an empty picker and a filled-in time.
    if (restored.appointment_date) {
      void loadSlots(restored.appointment_date, restored.barber_id, restored.services);
    }
  }, [restored, loadSlots]);

  useEffect(() => {
    // Nothing worth saving yet: an untouched empty form would just evict a
    // previous draft with nothing to show for it.
    const hasContent =
      form.services.length > 0 ||
      form.first_name ||
      form.phone ||
      form.appointment_date;
    if (hasContent) writeBookingDraft(form, publicSlug);
  }, [form, publicSlug]);

  /* ── Derived ────────────────────────────────────────────────────────── */

  const salonName =
    business.salonName || business.salon_name || BRAND.name;
  const currency = business.currency || "ج.م";
  const homePath = publicSlug ? buildPublicSalonPath(business) : "/";
  const logoImage = resolveAssetUrl(business.logoUrl || business.logo_url);

  /**
   * Directions and WhatsApp, for the confirmation.
   *
   * Both use the shared `buildWhatsappUrl` rather than a local copy — a local
   * copy is exactly how the hard-coded Egyptian country code ended up applying
   * to every salon in every country.
   */
  const whatsappUrlForSalon = buildWhatsappUrl(
    business.shopWhatsApp || business.shop_whatsapp || business.shop_phone,
  );
  const mapsUrlForSalon =
    business.googleMapsUrl ||
    business.google_maps_url ||
    (business.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
      : null);

  const selectedServices = useMemo(
    () =>
      form.services
        .map((chosen) =>
          (catalog.services ?? []).find(
            (service: any) => service.id === chosen.service_id,
          ),
        )
        .filter(Boolean) as any[],
    [catalog.services, form.services],
  );

  const total = selectedServices.reduce(
    (sum, service) => sum + Number(service?.price || 0) * Number(service?.quantity || 1),
    0,
  );

  const duration = selectedServices.reduce(
    (sum, service) =>
      sum + Number(service?.duration_minutes || service?.duration || 0),
    0,
  );

  const barberName = useMemo(() => {
    if (!form.barber_id) return t("booking.anyBarber");
    const match = (catalog.barbers ?? []).find(
      (barber: any) => barber.id === form.barber_id,
    );
    return match?.display_name || t("booking.anyBarber");
  }, [catalog.barbers, form.barber_id, t]);

  /** Slots grouped into the three bands the picker renders. */
  const slotBands = useMemo(() => {
    const band = (from: number, to: number) =>
      slots.filter((slot) => {
        const hour = Number.parseInt(slot.split(":")[0], 10);
        return hour >= from && hour < to;
      });
    return {
      morning: band(0, 12),
      afternoon: band(12, 17),
      evening: band(17, 24),
    };
  }, [slots]);

  useSEO({
    title: `${t("booking.title")} — ${salonName}`,
    description: t("booking.metaDescription"),
    noindex: true,
  });

  /* ── Actions ────────────────────────────────────────────────────────── */

  function patch(changes: Partial<BookingForm>) {
    setForm((previous) => ({ ...previous, ...changes }));
  }

  function toggleService(id: number | string) {
    setForm((previous) => {
      const exists = previous.services.some(
        (service) => service.service_id === id,
      );
      return {
        ...previous,
        services: exists
          ? previous.services.filter((service) => service.service_id !== id)
          : [...previous.services, { service_id: id, quantity: 1 }],
      };
    });
  }

  function onDateChange(date: string) {
    patch({ appointment_date: date, appointment_time: "" });
    void loadSlots(date, form.barber_id, form.services);
  }

  function onBarberChange(barberId: number | string | null) {
    patch({ barber_id: barberId });
    // Slot availability is per barber, so a change here invalidates whatever
    // the visitor had picked.
    if (form.appointment_date) {
      patch({ appointment_time: "" });
      void loadSlots(form.appointment_date, barberId, form.services);
    }
  }

  function next() {
    if (step === 1 && !form.services.length) {
      toast.error(t("booking.error.noService"));
      // Only *which* field failed, never what was typed: this is a form full of
      // a visitor's name and phone number.
      trackEvent("booking_validation_failed", { step, field: "services" });
      return;
    }
    if (step === 3 && (!form.appointment_date || !form.appointment_time)) {
      toast.error(t("booking.error.noDateTime"));
      trackEvent("booking_validation_failed", {
        step,
        field: !form.appointment_date ? "appointment_date" : "appointment_time",
      });
      return;
    }
    setStep((current) => Math.min(current + 1, 4));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 1));
  }

  async function submit() {
    const missing: string[] = [];
    if (!form.first_name.trim()) missing.push("first_name");
    if (!form.phone.trim()) missing.push("phone");

    if (missing.length) {
      toast.error(t("booking.error.fixFields"));
      trackEvent("booking_validation_failed", { step, fields: missing });
      return;
    }

    try {
      setSubmitting(true);
      const response: any = await api.post("/public/booking", {
        ...form,
        // An untouched optional field must be null, not "": Pydantic accepts
        // `null` for an optional email and rejects an empty string as invalid.
        email: form.email.trim() === "" ? null : form.email.trim(),
      });

      const data = response?.data ?? response ?? {};
      const appointmentId = Number(data.appointment_id ?? 0) || undefined;

      setReceipt({
        salonName,
        // The API returns no separate reference, so the appointment id is the
        // durable handle the visitor can quote on the call.
        reference: appointmentId ? `#${appointmentId}` : "—",
        appointmentId,
        date: form.appointment_date,
        time: form.appointment_time,
        timeLabel: time12(form.appointment_time),
        services: selectedServices.map(
          (service: any) => service.name_ar || service.name,
        ),
        barberName,
        customerName: `${form.first_name} ${form.last_name}`.trim(),
        customerPhone: form.phone,
        notes: form.notes || undefined,
        address: business.address || undefined,
        durationMinutes: duration || undefined,
        mapsUrl: mapsUrlForSalon ?? undefined,
        whatsappUrl: whatsappUrlForSalon ?? undefined,
        pageUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      });

      clearBookingDraft(publicSlug);
      setStep(CONFIRMED);
      toast.success(t("booking.success"));
      trackEvent("booking_completed", {
        services: form.services.length,
        has_barber: Boolean(form.barber_id),
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("booking.error.submit")));
      trackEvent("booking_submit_failed", { step });
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-[length:var(--r-lg)] border border-line bg-panel text-accent">
            <Scissors size={28} aria-hidden="true" />
          </div>
          <p
            role="status"
            className="text-[length:var(--step--1)] font-medium uppercase text-ink-faint"
            style={{ letterSpacing: "var(--tracking-eyebrow)" }}
          >
            {t("booking.loading")}
          </p>
        </div>
      </div>
    );
  }

  const currentStep = STEPS.find((item) => item.id === Math.min(step, 4))!;
  const visibleCategories = (catalog.categories ?? []).filter(
    (item: any) => category === "all" || item.id === category,
  );

  return (
    <div className="grain relative min-h-screen">
      <header className="topbar">
        <div className="shell relative z-10 flex items-center justify-between gap-4 py-3.5">
          <button
            type="button"
            onClick={() => navigate(homePath)}
            className="flex min-w-0 items-center gap-3 text-start"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[length:var(--r-sm)] border border-line bg-panel text-accent">
              {logoImage ? (
                <img src={logoImage} alt={salonName} className="h-full w-full object-cover" />
              ) : (
                <Scissors size={20} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[length:var(--step-0)] font-bold">
                {salonName}
              </span>
              <span
                className="block text-[length:var(--step--2)] font-medium uppercase text-ink-faint"
                style={{ letterSpacing: "var(--tracking-eyebrow)" }}
              >
                {t("booking.secure")}
              </span>
            </span>
          </button>

          <Button size="sm" onClick={() => navigate(homePath)} variant="outline">
            <ArrowLeft size={15} aria-hidden="true" className="rtl-flip" />
            {t("nav.home")}
          </Button>
        </div>
      </header>

      <main id="main-content" className="relative z-10 shell pb-24 pt-12" tabIndex={-1}>
        {step === CONFIRMED && receipt ? (
          <BookingConfirmation
            details={receipt}
            t={t}
            locale={locale}
            onDone={() => navigate(homePath)}
            doneLabel={t("booking.backHomeCta")}
          />
        ) : step === CONFIRMED ? (
          <div className="mx-auto max-w-xl py-10 text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-accent-line bg-accent-wash text-accent">
              <CheckCircle2 size={44} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h1 className="mt-8 text-[length:var(--step-4)] font-bold leading-tight text-balance">
              {t("booking.success")}
            </h1>
            <p className="mx-auto mt-4 text-[length:var(--step-0)] leading-relaxed text-ink-soft">
              {t("booking.successBody", { salon: salonName })}
            </p>
            <Button onClick={() => navigate(homePath)} className="mt-10 w-full sm:w-auto">
              <CalendarDays size={17} aria-hidden="true" />
              {t("booking.backHomeCta")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            {/* ── The form ─────────────────────────────────────────── */}
            <div className="lg:col-span-7 xl:col-span-8">
              <header className="mb-8">
                <p
                  className="text-[length:var(--step--2)] font-semibold uppercase text-accent"
                  style={{ letterSpacing: "var(--tracking-eyebrow)" }}
                >
                  {t("booking.stepOf", { current: Math.min(step, 4), total: 4 })}
                </p>
                <h1 className="mt-2 text-[length:var(--step-4)] font-bold leading-tight text-balance">
                  {t(currentStep.key)}
                </h1>
                <p className="mt-2 text-[length:var(--step-0)] text-ink-soft">
                  {t(currentStep.hintKey)}
                </p>
              </header>

              {/* Progress: a hairline rail with four notches, rather than the
                  previous glowing gold bar. The notch for a completed step
                  fills; the current one is ringed. */}
              <ol className="mb-10 flex items-center gap-2" aria-hidden="true">
                {STEPS.map((item) => (
                  <li key={item.id} className="flex-1">
                    <span
                      className={`block h-1 rounded-full transition-colors duration-300 ${
                        step >= item.id ? "bg-accent" : "bg-[color:var(--c-border)]"
                      }`}
                    />
                  </li>
                ))}
              </ol>

              {/* ── Step 1: services ─────────────────────────────── */}
              {step === 1 ? (
                <section aria-labelledby="step-services">
                  <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hidden">
                    <CategoryChip
                      active={category === "all"}
                      onClick={() => setCategory("all")}
                    >
                      {t("booking.allCategories")}
                    </CategoryChip>
                    {(catalog.categories ?? []).map((item: any) => (
                      <CategoryChip
                        key={item.id}
                        active={category === item.id}
                        onClick={() => setCategory(item.id)}
                      >
                        {item.name_ar || item.name}
                      </CategoryChip>
                    ))}
                  </div>

                  {visibleCategories.length ? (
                    <div className="space-y-9">
                      {visibleCategories.map((group: any) => {
                        const groupServices = (catalog.services ?? []).filter(
                          (service: any) => service.category_id === group.id,
                        );
                        if (!groupServices.length) return null;

                        return (
                          <div key={group.id}>
                            <h2
                              id="step-services"
                              className="mb-3 text-[length:var(--step--1)] font-semibold uppercase text-ink-faint"
                              style={{ letterSpacing: "var(--tracking-eyebrow)" }}
                            >
                              {group.name_ar || group.name}
                            </h2>
                            <ul className="rule-grid border-t border-line">
                              {groupServices.map((service: any) => {
                                const selected = form.services.some(
                                  (item) => item.service_id === service.id,
                                );
                                return (
                                  <li key={service.id}>
                                    <button
                                      type="button"
                                      onClick={() => toggleService(service.id)}
                                      aria-pressed={selected}
                                      className={`flex w-full items-center justify-between gap-4 border-b border-line px-1 py-4 text-start transition-colors duration-200 ${
                                        selected
                                          ? "bg-accent-wash"
                                          : "hover:bg-[color:var(--c-inset)]"
                                      }`}
                                    >
                                      <span className="flex min-w-0 items-center gap-4">
                                        <span
                                          aria-hidden="true"
                                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[length:var(--r-sm)] border transition-colors duration-200 ${
                                            selected
                                              ? "border-accent bg-accent text-on-accent"
                                              : "border-line bg-panel text-ink-faint"
                                          }`}
                                        >
                                          {selected ? (
                                            <CheckCircle2 size={18} />
                                          ) : (
                                            <Scissors size={17} />
                                          )}
                                        </span>
                                        <span className="min-w-0">
                                          <span className="block truncate text-[length:var(--step-0)] font-semibold">
                                            {service.name_ar || service.name}
                                          </span>
                                          <span className="mt-0.5 flex items-center gap-1.5 text-[length:var(--step--2)] text-ink-faint">
                                            <Clock3 size={11} aria-hidden="true" />
                                            <span className="numeric">
                                              {service.duration_minutes ?? service.duration}
                                            </span>
                                            {t("common.minutes")}
                                          </span>
                                        </span>
                                      </span>
                                      <span className="numeric shrink-0 text-[length:var(--step-1)] font-bold text-accent">
                                        {formatPrice(Number(service.price || 0))}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="well px-6 py-12 text-center text-[length:var(--step-0)] text-ink-soft">
                      {t("booking.noServicesInCategory")}
                    </p>
                  )}
                </section>
              ) : null}

              {/* ── Step 2: barber ──────────────────────────────── */}
              {step === 2 ? (
                <section aria-labelledby="step-barber">
                  <h2 id="step-barber" className="sr-only">
                    {t("booking.step.barber")}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <BarberCard
                      selected={form.barber_id === null}
                      onClick={() => onBarberChange(null)}
                      label={t("booking.anyBarber")}
                      caption={t("booking.anyBarberCaption")}
                      fallback={<User size={26} aria-hidden="true" />}
                    />
                    {(catalog.barbers ?? []).map((barber: any) => (
                      <BarberCard
                        key={barber.id}
                        selected={form.barber_id === barber.id}
                        onClick={() => onBarberChange(barber.id)}
                        label={barber.display_name || t("booking.anyBarber")}
                        caption={barber.job_title || undefined}
                        fallback={<User size={26} aria-hidden="true" />}
                        image={resolveAssetUrl(barber.profile_image_url)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* ── Step 3: slot ────────────────────────────────── */}
              {step === 3 ? (
                <section aria-labelledby="step-slot" className="space-y-8">
                  <h2 id="step-slot" className="sr-only">
                    {t("booking.step.schedule")}
                  </h2>

                  <div className="max-w-xs">
                    <label
                      htmlFor="booking-date"
                      className="mb-2 block text-[length:var(--step--1)] font-semibold"
                    >
                      {t("booking.pickDate")}
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      value={form.appointment_date}
                      min={new Date().toISOString().slice(0, 10)}
                      max={new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)}
                      onChange={(event) => onDateChange(event.target.value)}
                      className="input h-12 px-4 text-[length:var(--step--1)]"
                      style={{ colorScheme: theme.isDark ? "dark" : "light" }}
                    />
                  </div>

                  {!form.appointment_date ? (
                    <p className="well px-6 py-16 text-center text-[length:var(--step-0)] text-ink-soft">
                      {t("booking.pickDateFirst")}
                    </p>
                  ) : slotsLoading ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {Array.from({ length: 8 }, (_, index) => (
                        <div key={index} className="skeleton-shimmer h-12 rounded-[length:var(--r-sm)]" />
                      ))}
                    </div>
                  ) : !slots.length ? (
                    <p className="well border-[color:var(--c-stop)] px-6 py-16 text-center text-[length:var(--step-0)] text-[color:var(--c-stop)]">
                      {t("booking.noSlots")}
                    </p>
                  ) : (
                    <div className="space-y-7">
                      {(
                        [
                          ["booking.slots.morning", slotBands.morning],
                          ["booking.slots.afternoon", slotBands.afternoon],
                          ["booking.slots.evening", slotBands.evening],
                        ] as const
                      )
                        .filter(([, list]) => list.length)
                        .map(([labelKey, list]) => (
                          <div key={labelKey}>
                            <h3
                              className="mb-3 text-[length:var(--step--2)] font-semibold uppercase text-ink-faint"
                              style={{ letterSpacing: "var(--tracking-eyebrow)" }}
                            >
                              {t(labelKey)}
                            </h3>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                              {list.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => patch({ appointment_time: slot })}
                                  aria-pressed={form.appointment_time === slot}
                                  className={`h-12 rounded-[length:var(--r-sm)] border text-[length:var(--step--1)] font-semibold transition-colors duration-200 ${
                                    form.appointment_time === slot
                                      ? "border-accent bg-accent text-on-accent"
                                      : "border-line bg-panel text-ink-soft hover:border-accent-line hover:text-accent"
                                  }`}
                                >
                                  {time12(slot)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </section>
              ) : null}

              {/* ── Step 4: details ─────────────────────────────── */}
              {step === 4 ? (
                <section aria-labelledby="step-details">
                  <h2 id="step-details" className="sr-only">
                    {t("booking.step.details")}
                  </h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      id="first-name"
                      label={t("booking.field.firstName")}
                      value={form.first_name}
                      onChange={(value) => patch({ first_name: value })}
                    />
                    <Field
                      id="last-name"
                      label={t("booking.field.lastName")}
                      value={form.last_name}
                      onChange={(value) => patch({ last_name: value })}
                    />
                    <Field
                      id="phone"
                      label={t("booking.field.phone")}
                      value={form.phone}
                      onChange={(value) => patch({ phone: value })}
                      type="tel"
                      inputMode="tel"
                      ltr
                      required
                    />
                    <Field
                      id="email"
                      label={t("booking.field.email")}
                      hint={t("common.optional")}
                      value={form.email}
                      onChange={(value) => patch({ email: value })}
                      type="email"
                      inputMode="email"
                      ltr
                    />
                  </div>

                  <div className="mt-5">
                    <label
                      htmlFor="notes"
                      className="mb-2 block text-[length:var(--step--1)] font-semibold"
                    >
                      {t("booking.field.notes")}{" "}
                      <span className="font-normal text-ink-faint">
                        ({t("common.optional")})
                      </span>
                    </label>
                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={(event) => patch({ notes: event.target.value })}
                      rows={4}
                      className="input min-h-28 resize-y p-4 text-[length:var(--step--1)]"
                    />
                  </div>
                </section>
              ) : null}

              {/* ── Nav ────────────────────────────────────────── */}
              <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
                {step > 1 ? (
                  <Button variant="ghost" onClick={back}>
                    {t("common.back")}
                  </Button>
                ) : (
                  <span />
                )}

                {step < 4 ? (
                  <Button onClick={next}>
                    {/* The button names where it is going, not "next": on a
                        four-step form a visitor who has not read the header
                        still knows where they are. */}
                    {t(
                      step === 1
                        ? "booking.nextToBarber"
                        : step === 2
                          ? "booking.nextToSchedule"
                          : "booking.nextToDetails",
                    )}
                    <ChevronLeft size={16} aria-hidden="true" className="rtl-flip" />
                  </Button>
                ) : (
                  <Button onClick={submit} loading={submitting}>
                    {submitting ? t("booking.submitting") : t("booking.submit")}
                  </Button>
                )}
              </div>
            </div>

            {/* ── Summary ───────────────────────────────────────── */}
            <aside className="lg:col-span-5 xl:col-span-4">
              <div className="well p-6 lg:sticky lg:top-24">
                <h2 className="text-[length:var(--step-1)] font-bold">
                  {t("booking.summaryHeading")}
                </h2>

                <dl className="mt-5 space-y-3 text-[length:var(--step--1)]">
                  <SummaryRow
                    label={t("common.services")}
                    value={String(selectedServices.length)}
                  />
                  <SummaryRow label={t("booking.summary.barber")} value={barberName} />
                  <SummaryRow
                    label={t("booking.summary.date")}
                    value={form.appointment_date || "—"}
                  />
                  <SummaryRow
                    label={t("booking.summary.time")}
                    value={form.appointment_time ? time12(form.appointment_time) : "—"}
                  />
                  <SummaryRow
                    label={t("booking.durationEstimate")}
                    value={
                      duration ? `${duration} ${t("common.minutes")}` : "—"
                    }
                  />
                </dl>

                <div className="mt-6 border-t border-line pt-5">
                  <p
                    className="text-[length:var(--step--2)] font-semibold uppercase text-ink-faint"
                    style={{ letterSpacing: "var(--tracking-eyebrow)" }}
                  >
                    {t("booking.selectedServices")}
                  </p>
                  {selectedServices.length ? (
                    <ul className="mt-3 space-y-2">
                      {selectedServices.map((service: any) => (
                        <li
                          key={service.id}
                          className="flex items-center justify-between gap-3 text-[length:var(--step--1)]"
                        >
                          <span className="truncate text-ink-soft">
                            {service.name_ar || service.name}
                          </span>
                          <span className="numeric shrink-0 font-semibold">
                            {formatPrice(Number(service.price || 0))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[length:var(--step--1)] text-ink-faint">
                      {t("booking.cartEmpty")}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex items-baseline justify-between gap-3 border-t border-line pt-5">
                  <span
                    className="text-[length:var(--step--1)] font-semibold uppercase text-ink-faint"
                    style={{ letterSpacing: "var(--tracking-eyebrow)" }}
                  >
                    {t("booking.summary.total")}
                  </span>
                  <span className="numeric text-[length:var(--step-2)] font-bold text-accent">
                    {formatPrice(total)} {currency}
                  </span>
                </div>

                {business.address || business.shop_phone || business.shopPhone ? (
                  <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-[length:var(--step--1)] text-ink-soft">
                    {business.address ? (
                      <li className="flex items-start gap-2.5">
                        <MapPin size={14} aria-hidden="true" className="mt-1 shrink-0 text-accent" />
                        <span>{business.address}</span>
                      </li>
                    ) : null}
                    {business.shop_phone || business.shopPhone ? (
                      <li className="flex items-start gap-2.5">
                        <Phone size={14} aria-hidden="true" className="mt-1 shrink-0 text-accent" />
                        <span className="numeric">
                          {business.shop_phone || business.shopPhone}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-[length:var(--r-sm)] border px-4 py-2 text-[length:var(--step--1)] font-medium transition-colors duration-200 ${
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-panel text-ink-soft hover:border-accent-line hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function BarberCard({
  selected,
  onClick,
  label,
  caption,
  image,
  fallback,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  caption?: string;
  image?: string | null;
  fallback: React.ReactNode;
}) {
  // A stored path whose file is gone is a truthy URL that answers 404, so the
  // `<img>` would render as a broken image rather than the initial fallback.
  const [photoBroken, setPhotoBroken] = useState(false);
  const showPhoto = Boolean(image) && !photoBroken;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-3 rounded-[length:var(--r-lg)] border p-5 text-center transition-colors duration-200 ${
        selected
          ? "border-accent bg-accent-wash"
          : "border-line bg-panel hover:border-accent-line"
      }`}
    >
      <span
        className={`grid h-20 w-20 place-items-center overflow-hidden rounded-[length:var(--r-md)] border ${
          selected ? "border-accent" : "border-line"
        }`}
      >
        {showPhoto ? (
          <img
            src={image as string}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setPhotoBroken(true)}
          />
        ) : (
          <span className={selected ? "text-accent" : "text-ink-faint"}>{fallback}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[length:var(--step--1)] font-semibold">
          {label}
        </span>
        {caption ? (
          <span className="mt-0.5 block truncate text-[length:var(--step--2)] text-ink-faint">
            {caption}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  inputMode,
  ltr = false,
  required = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "tel" | "email" | "text";
  ltr?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[length:var(--step--1)] font-semibold">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
        {hint ? <span className="font-normal text-ink-faint"> — {hint}</span> : null}
      </label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Phone numbers and email addresses are LTR runs inside an RTL line;
        // without this the punctuation jumps to the wrong end.
        dir={ltr ? "ltr" : undefined}
        required={required}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="truncate text-end font-semibold">{value}</dd>
    </div>
  );
}
