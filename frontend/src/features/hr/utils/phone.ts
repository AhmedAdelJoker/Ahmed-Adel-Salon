/**
 * Phone validation for the employee form.
 *
 * Kept pure and separate so it can be unit-tested without mounting the wizard.
 * The rules are deliberately lenient about *shape* (separators, a country code)
 * and strict about *identity*: a duplicate primary number is the error that
 * actually costs money, because two barbers sharing a number means attendance
 * and payouts land against the wrong person.
 */
import { digitsOnly, normalizeNumericInput } from "./digits";

/** The longest a real phone number can be (ITU E.164). */
export const MAX_PHONE_DIGITS = 15;

/**
 * Digits left after dropping spaces, dashes and the parentheses people type.
 *
 * Numerals are read through `digitsOnly`, so an Egyptian keyboard's ٠١٠… is the
 * same number as 010… . Plain `\d` here used to strip Arabic-Indic digits
 * entirely: "٠١٠١٢٣٤٥٦٧٨" became "" and the owner was told the *required* phone
 * was missing while it sat right there on screen.
 */
export function phoneDigits(value: string | null | undefined): string {
  return digitsOnly(value);
}

/**
 * What the field holds while typing: digits only, Arabic numerals converted on
 * the fly, capped at 15 so a sixteenth digit simply does not register instead
 * of producing a value that can never be saved.
 */
export function normalizePhoneTyping(value: string | null | undefined): string {
  return normalizeNumericInput(value, MAX_PHONE_DIGITS);
}

/**
 * A primary number has to be dialable: 8–15 digits (ITU E.164 territory), with
 * an Egyptian mobile as the shape most of this roster actually uses.
 * Returns an error message, or null when the number is acceptable.
 */
export function validatePhone(value: string | null | undefined): string | null {
  const digits = phoneDigits(value);

  if (!digits) return "رقم الجوال مطلوب";

  // Common keypad typo: the same digit repeated enough times that it is almost
  // certainly a miskey. Six in a row, not five: an Egyptian number like
  // 01000007777 legitimately contains a five-run, and rejecting a real number
  // is worse than accepting one odd-looking fake.
  if (/(\d)\1{5,}/.test(digits)) {
    return "رقم الجوال غير صحيح (أرقام متكررة)";
  }

  if (digits.length < 8 || digits.length > 15) {
    return "رقم الجوال غير صحيح (من 8 إلى 15 رقمًا)";
  }

  // Egyptian mobiles are 11 digits starting 01. If it looks Egyptian but is
  // not, say so plainly rather than reporting a generic length error.
  if (digits.startsWith("01") && digits.length !== 11) {
    return "رقم الجوال غير صحيح (رقم محمول مصري = 11 رقمًا يبدأ بـ 01)";
  }
  // 0 alone, or a local number starting with 0 that is far too short to be one.
  if (/^0\d{0,2}$/.test(digits)) {
    return "رقم الجوال غير صحيح";
  }

  return null;
}

/**
 * Compare two numbers the way a human would read them, so 0100 123 4567 and
 * 01001234567 are recognised as the same number rather than two.
 */
export function isSamePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneDigits(a);
  const right = phoneDigits(b);
  if (!left || !right) return false;
  if (left === right) return true;
  /*
    Compare on the national significant number, so +201001234567 matches
    01001234567: drop the country code, then the trunk zero that the
    international form omits. Trunk, not leading zeros generally — "0" is
    meaningful in a national number.
  */
  const national = (v: string) => {
    const withoutCode = v.length === 12 && v.startsWith("20") ? v.slice(2) : v;
    return withoutCode.startsWith("0") ? withoutCode.slice(1) : withoutCode;
  };
  return national(left) === national(right);
}

/** Employee ids arrive as numbers from the API but are typed loosely at the call site. */
export type EmployeeId = string | number | null | undefined;

/**
 * The employee's own email, as opposed to the login account's.
 *
 * Mirrors the backend validator in `app/schemas/employee.py` so the owner is
 * told here rather than bouncing off a 422 after filling in six steps.
 * Deliberately shape-only: an address that looks wrong is caught, an address
 * that merely bounces is not something this form could know.
 */
export function validateEmployeeEmail(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return "البريد الإلكتروني مطلوب";

  const at = text.split("@");
  if (at.length !== 2) return "البريد الإلكتروني غير صالح";
  const [local, domain] = at;
  if (!local || !domain) return "البريد الإلكتروني غير صالح";
  if (/\s/.test(text)) return "البريد الإلكتروني غير صالح";
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "البريد الإلكتروني غير صالح";
  }
  // A domain has no spaces or consecutive dots, and needs characters either side
  // of every dot.
  if (domain.includes("..") || /\.$/.test(domain) || /^\./.test(domain)) {
    return "البريد الإلكتروني غير صالح";
  }
  return null;
}

export interface PhoneConflict {
  id: string | number;
  name: string;
  phone: string;
}

/**
 * Find an existing employee already holding this number.
 *
 * `excludeId` is the employee being edited: changing someone's phone must not
 * collide with the row you are currently standing on.
 */
export function findPhoneConflict(
  phone: string | null | undefined,
  candidates: Array<{ id: EmployeeId; fullName?: string | null; phonePrimary?: string | null }>,
  excludeId?: EmployeeId,
): PhoneConflict | null {
  if (!phoneDigits(phone)) return null;

  const skipId = excludeId == null ? null : String(excludeId);
  for (const emp of candidates ?? []) {
    if (!emp) continue;
    if (skipId != null && String(emp.id) === skipId) continue;
    if (isSamePhone(emp.phonePrimary, phone)) {
      return { id: emp.id as string | number, name: emp.fullName || "موظف موجود", phone: emp.phonePrimary || "" };
    }
  }
  return null;
}