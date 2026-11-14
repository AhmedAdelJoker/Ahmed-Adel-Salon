import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardCopy,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  Send,
} from "lucide-react";
import api from "../../services/api";
import { buildCalendarFile, downloadCalendarFile } from "../../lib/ical";
import { formatDate } from "../../lib/i18n";
import type { Translate } from "../landing/OwnerSections";

export interface ConfirmationDetails {
  salonName: string;
  reference: string;
  /** The appointment ID, used for review submission. */
  appointmentId?: number;
  date: string;
  /** 24h `HH:mm` as stored by the API. */
  time: string;
  /** Pre-formatted for display, e.g. `03:30 م`. */
  timeLabel: string;
  services: string[];
  barberName?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  address?: string;
  durationMinutes?: number;
  mapsUrl?: string;
  whatsappUrl?: string;
  /** Canonical URL of the public page, embedded in the .ics description. */
  pageUrl?: string;
}

export interface BookingConfirmationProps {
  details: ConfirmationDetails;
  t: Translate;
  locale: string;
  onDone: () => void;
  doneLabel: string;
}

const GOLD = "var(--c-accent)";
const INK = "var(--c-bg)";

/**
 * Post-booking confirmation.
 *
 * The old confirmation was a gold tick, two lines of text, the date and time,
 * and a "back home" button — i.e. the visitor had to photograph the screen to
 * remember their appointment, and the salon had no way to reach them.
 *
 * What a real salon sends, and what this now sends:
 *  - a reference that is quoted on the call if anything goes wrong;
 *  - the full appointment, not just date and time;
 *  - a calendar file, which is the difference between an appointment that
 *    happens and one that is remembered;
 *  - one-tap WhatsApp and directions, so "how do I find you" and "are we still
 *    on?" do not become a phone call to the salon.
 */
export default function BookingConfirmation({
  details,
  t,
  locale,
  onDone,
  doneLabel,
}: BookingConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const formattedDate = formatDate(details.date, locale as "ar" | "en");

  const calendar = useMemo(
    () =>
      buildCalendarFile({
        uid: details.reference,
        salonName: details.salonName,
        date: details.date,
        time: details.time,
        durationMinutes: details.durationMinutes,
        services: details.services,
        barberName: details.barberName,
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        notes: details.notes,
        address: details.address,
        url: details.pageUrl,
      }),
    [details],
  );

  const whatsappMessage = useMemo(() => {
    const lines = [
      `*${details.salonName}*`,
      t("booking.confirmation.reference", { reference: details.reference }),
      t("booking.confirmation.date", { date: formattedDate }),
      t("booking.confirmation.time", { time: details.timeLabel }),
      details.services.length ? t("booking.confirmation.services", { services: details.services.join(" · ") }) : null,
    ].filter(Boolean);
    return encodeURIComponent(lines.join("\n"));
  }, [details, t, formattedDate]);

  const summaryText = useMemo(
    () =>
      [
        details.salonName,
        t("booking.confirmation.reference", { reference: details.reference }),
        t("booking.confirmation.date", { date: formattedDate }),
        t("booking.confirmation.time", { time: details.timeLabel }),
        details.services.length ? t("booking.confirmation.services", { services: details.services.join(" · ") }) : null,
        details.address || null,
      ]
        .filter(Boolean)
        .join("\n"),
    [details, t, formattedDate],
  );

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is denied in some browsers over plain HTTP; the visitor
      // still has the calendar file and the WhatsApp button.
    }
  }

  async function submitReview() {
    if (reviewRating === 0) {
      setReviewError(t("booking.review.selectRating"));
      return;
    }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await api.post("/reviews", {
        appointment_id: details.appointmentId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewSubmitted(true);
    } catch (err: any) {
      setReviewError(err?.response?.data?.detail || t("booking.review.error"));
    } finally {
      setReviewSubmitting(false);
    }
  }

  return (
    <div
      aria-live="polite"
      className="relative space-y-8 overflow-hidden rounded-[2.5rem] border border-line bg-inset p-7 text-center sm:p-10"
    >
      <div
        className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: `${GOLD}1A`, border: `1px solid ${GOLD}59`, color: GOLD }}
      >
        <CheckCircle2 size={48} strokeWidth={1.5} aria-hidden="true" />
      </div>

      <div className="space-y-3 px-2">
        <h2 className="text-[length:var(--step-2)] font-bold leading-tight text-ink">
          {t("booking.success")}
        </h2>
        <p className="mx-auto w-full max-w-lg text-sm font-bold leading-7 text-ink-soft sm:text-base">
          {t("booking.successBody", { salon: details.salonName })}
        </p>
      </div>

      {/*
        The reference is the single most useful thing on this screen: it is what
        the salon asks for on the phone, and it is what makes a dispute about the
        date or the price resolvable. It is given visual weight rather than being
        buried as a caption.
      */}
      <div
        className="mx-auto w-full max-w-md rounded-3xl border px-6 py-5"
        style={{ borderColor: `${GOLD}33`, backgroundColor: `${GOLD}0D` }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
          {t("booking.confirmation.referenceLabel")}
        </p>
        <p className="numeric mt-2 text-2xl font-bold text-ink">{details.reference}</p>
      </div>

      <dl className="mx-auto w-full max-w-md divide-y divide-line overflow-hidden rounded-3xl border border-line text-start">
        <Row label={t("booking.summary.date")} value={formattedDate} />
        <Row label={t("booking.summary.time")} value={details.timeLabel} />
        {details.services.length ? (
          <Row label={t("booking.confirmation.servicesLabel")} value={details.services.join(" · ")} />
        ) : null}
        {details.barberName ? (
          <Row label={t("booking.summary.barber")} value={details.barberName} />
        ) : null}
      </dl>

      {/* Calendar first: it is the action with the highest completion rate. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {calendar ? (
          <button
            type="button"
            onClick={() => downloadCalendarFile(calendar, `booking-${details.reference}`)}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl px-7 text-sm font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ backgroundColor: GOLD, color: INK }}
          >
            <CalendarPlus size={18} aria-hidden="true" />
            {t("booking.confirmation.addToCalendar")}
          </button>
        ) : null}

        {details.whatsappUrl ? (
          <a
            href={`${details.whatsappUrl}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong px-7 text-sm font-bold text-ink transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MessageCircle size={18} aria-hidden="true" style={{ color: GOLD }} />
            {t("booking.confirmation.sendWhatsapp")}
          </a>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {details.mapsUrl ? (
          <a
            href={details.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line px-6 text-xs font-bold text-ink-soft transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MapPin size={16} aria-hidden="true" style={{ color: GOLD }} />
            {t("booking.confirmation.directions")}
          </a>
        ) : null}

        {details.customerPhone ? (
          <a
            href={`tel:${details.customerPhone.replace(/\s/g, "")}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line px-6 text-xs font-bold text-ink-soft transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Phone size={16} aria-hidden="true" style={{ color: GOLD }} />
            {t("booking.confirmation.callSalon")}
          </a>
        ) : null}

        <button
          type="button"
          onClick={copySummary}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line px-6 text-xs font-bold text-ink-soft transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ClipboardCopy size={16} aria-hidden="true" style={{ color: copied ? "#10B981" : GOLD }} />
          {copied ? t("booking.confirmation.copied") : t("booking.confirmation.copyDetails")}
        </button>
      </div>

      {details.notes ? (
        <p className="mx-auto w-full max-w-md text-start text-xs font-bold leading-6 text-ink-faint">
          <span className="font-bold text-ink-soft">{t("booking.confirmation.notesLabel")}: </span>
          {details.notes}
        </p>
      ) : null}

      {/* Review submission */}
      {details.appointmentId && !reviewSubmitted ? (
        <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-inset p-6 text-start">
          <h3 className="text-sm font-bold text-ink mb-3">{t("booking.review.title")}</h3>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setReviewRating(star)}
                className="p-1 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                aria-label={t("booking.review.starLabel", { star })}
              >
                <Star
                  size={20}
                  fill={star <= reviewRating ? "var(--c-accent)" : "transparent"}
                  color={star <= reviewRating ? "var(--c-accent)" : "#6B7280"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder={t("booking.review.placeholder")}
            rows={3}
            className="w-full rounded-2xl border border-line bg-inset px-4 py-3 text-sm font-bold text-ink placeholder:text-[color:var(--c-faint)] focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 resize-none"
          />
          {reviewError ? (
            <p className="mt-2 text-xs font-bold text-rose-400">{reviewError}</p>
          ) : null}
          <button
            type="button"
            onClick={submitReview}
            disabled={reviewSubmitting}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ backgroundColor: GOLD, color: INK }}
          >
            <Send size={16} aria-hidden="true" />
            {reviewSubmitting ? t("booking.review.submitting") : t("booking.review.submit")}
          </button>
        </div>
      ) : null}

      {reviewSubmitted ? (
        <div className="mx-auto w-full max-w-md rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-sm font-bold text-emerald-400">{t("booking.review.thanks")}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onDone}
        className="min-h-14 w-full max-w-sm rounded-2xl border border-line-strong px-8 text-sm font-bold text-ink transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {doneLabel}
      </button>

      <p className="sr-only" role="status">
        {t("booking.confirmation.announced", { reference: details.reference, date: formattedDate, time: details.timeLabel })}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
      <dt className="text-xs font-bold text-ink-faint">{label}</dt>
      <dd className="numeric text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}