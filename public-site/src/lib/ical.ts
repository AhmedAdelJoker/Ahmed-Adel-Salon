/**
 * RFC 5545 calendar export.
 *
 * Every major booking flow hands the visitor a calendar file. It is the single
 * cheapest "professional" feature on this list: without it the appointment only
 * exists on a salon server the visitor may never look at again, and the no-show
 * rate follows.
 *
 * What is easy to get wrong here, and is therefore handled explicitly below:
 *  - line endings must be CRLF, not LF;
 *  - `TEXT` values must have backslash, semicolon, comma and newline escaped;
 *  - `DTSTART` in a `VTIMEZONE`-less file must be floating local time or UTC,
 *    and mixing the two is how an event lands at the wrong hour;
 *  - lines longer than 75 octets must be folded;
 *  - `UID` has to be stable and unique or the calendar duplicates the event on
 *    every sync.
 */

/** Escape a value for an iCalendar TEXT property. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets per line.
 *
 * Counting is done on UTF-8 bytes, not characters — the limit is in octets, and
 * Arabic service names blow past it in half the characters. Splitting on
 * character boundaries keeps multi-byte sequences intact.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const char of line) {
    const size = encoder.encode(char).length;
    // Leave one byte for the leading space that continuation lines start with.
    if (currentBytes + size > 74) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

/** `20260904T153000Z` — the UTC form RFC 5545 requires for `Z` timestamps. */
function toUtcStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Interpret the salon's wall-clock slot in the visitor's own timezone.
 *
 * The catalogue has no timezone for the salon, so the only defensible reading of
 * "15:30" is the local time of the machine that is choosing it. `new Date(y, m,
 * d, h, min)` does exactly that and avoids the classic `new Date("2026-09-04")`
 * trap, which parses as UTC midnight and shifts the appointment a day.
 *
 * The bounds check is not defensive noise — it is the whole point. `new Date(y,
 * m, d, 99, 99)` does not throw, it rolls over into the following day at 05:35,
 * so an unvalidated slot silently produces an event at the wrong time. Nobody
 * notices until the visitor does not turn up on the right day.
 */
function slotToDate(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);

  if (monthNumber < 1 || monthNumber > 12) return null;
  if (dayNumber < 1 || dayNumber > 31) return null;
  if (hourNumber > 23 || minuteNumber > 59) return null;

  const parsed = new Date(yearNumber, monthNumber - 1, dayNumber, hourNumber, minuteNumber);
  if (Number.isNaN(parsed.getTime())) return null;

  // Reject a day that does not exist in that month, e.g. 2026-02-31.
  if (
    parsed.getFullYear() !== yearNumber ||
    parsed.getMonth() !== monthNumber - 1 ||
    parsed.getDate() !== dayNumber
  ) {
    return null;
  }

  return parsed;
}

export interface CalendarEventInput {
  /** Stable id for the event, e.g. the booking reference. */
  uid: string;
  salonName: string;
  /** `YYYY-MM-DD` as selected in the form. */
  date: string;
  /** `HH:mm` in 24h form, as the API stores it. */
  time: string;
  /** Minutes; defaults to 60 when the catalogue carries no duration. */
  durationMinutes?: number;
  /** Optional: a salon may accept a walk-in with nothing selected. */
  services?: string[];
  barberName?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  address?: string;
  url?: string;
}

export function buildCalendarFile(input: CalendarEventInput): string | null {
  const start = slotToDate(input.date, input.time);
  if (!start) return null;

  // Defaulted rather than dereferenced directly: the confirmation screen passes
  // whatever the catalogue held, and an absent list must not throw inside the
  // click handler that was meant to hand the visitor a calendar file.
  const services = input.services ?? [];

  const duration = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 60;
  const end = new Date(start.getTime() + duration * 60_000);

  const description = [
    services.length ? services.join(" · ") : null,
    input.barberName ? `${" barber "}${input.barberName}`.trim() : null,
    input.customerName ? `${" — "}${input.customerName}`.trim() : null,
    input.customerPhone ? `📞 ${input.customerPhone}` : null,
    input.notes ? `📝 ${input.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const headline = services.length ? `${input.salonName} — ${services.join(" · ")}` : input.salonName;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salon Management Pro//Public Booking//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Host + local-part from the reference: unique per booking, stable on re-export.
    `UID:${input.uid}@salon-pro`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeText(headline)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(input.address || input.salonName)}`,
    `STATUS:CONFIRMED`,
    `TRANSP:OPAQUE`,
    ...(input.url ? [`URL:${input.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/**
 * Hand the file to the browser.
 *
 * The object URL is revoked on the next tick: revoking it synchronously races
 * the download in Safari and produces an empty file.
 */
export function downloadCalendarFile(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}