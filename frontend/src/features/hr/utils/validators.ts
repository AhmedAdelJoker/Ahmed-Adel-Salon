/**
 * Shared field validation for the employee form.
 *
 * The backend enforces every rule here too (`app/core/employee_rules.py`) — this
 * module exists so the owner is told *while typing* instead of bouncing off a
 * 422 after six steps of work. Messages are worded identically on both sides on
 * purpose: seeing the same sentence twice is how a person learns to trust it.
 *
 * Convention, mirroring the phone validator: an empty value returns `null`
 * (absent is not wrong); required-ness is the caller's decision.
 */
import { toEnglishDigits } from "./digits";

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const MONEY_MAX = 1_000_000;

/** Arabic-Indic, Persian and ASCII digits — a name carries none of them. */
const NAME_DIGIT_RE = /[0-9\u0660-\u0669\u06f0-\u06f9]/;

/**
 * Letters (any script), combining marks, spaces and the punctuation real names
 * carry: "محمد عبد الله", "Jean-Luc", "O'Brien", "عبد الرحمن الشاذلي".
 */
const NAME_ALLOWED_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;

export function validatePersonName(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!text) return "الاسم مطلوب";
  if (text.length < NAME_MIN) return "الاسم قصير جدًا";
  if (text.length > NAME_MAX) return `الاسم طويل جدًا (${NAME_MAX} حرف كحد أقصى)`;
  if (NAME_DIGIT_RE.test(text)) return "الاسم لا يمكن أن يحتوي على أرقام";
  if (!NAME_ALLOWED_RE.test(text)) return "الاسم يحتوي على رموز غير مسموحة";

  return null;
}

/**
 * Usernames are credentials, not display names: ASCII letters, digits and
 * `. _ -` only, 3–30 characters. The backend authenticates with them, so an
 * Arabic username would type fine and fail at every login.
 */
export function validateUsername(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();

  if (!text) return "اسم المستخدم مطلوب";
  if (text.length < 3) return "اسم المستخدم 3 أحرف على الأقل";
  if (text.length > 30) return "اسم المستخدم 30 حرفًا كحد أقصى";
  if (!/^[a-zA-Z0-9._-]+$/.test(text)) {
    return "اسم المستخدم: حروف إنجليزية وأرقام و . _ - فقط";
  }

  return null;
}

/** A money field: non-negative and within the store's sanity ceiling. */
export function validateMoney(
  value: unknown,
  label: string,
): string | null {
  if (value === "" || value == null) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return `${label} يجب أن يكون رقمًا`;
  if (num < 0) return `${label} لا يمكن أن يكون بالسالب`;
  if (num > MONEY_MAX) {
    return `${label} يتجاوز الحد الأقصى (${MONEY_MAX.toLocaleString("en-US")})`;
  }

  return null;
}

/** Commission rates are percentages: 0–100, nothing outside. */
export function validateCommission(value: unknown): string | null {
  if (value === "" || value == null) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) return "نسبة العمولة يجب أن تكون رقمًا";
  if (num < 0 || num > 100) return "نسبة العمولة من 0 إلى 100%";

  return null;
}

/**
 * A bank account. Egyptian IBANs start with `EG` and carry 27 digits after it;
 * anything else is treated as a local account number — letters, digits and
 * separators, 4–34 characters. Loose on purpose: banks format account numbers
 * differently, and rejecting a real one is worse than accepting a stray dash.
 */
export function validateBankAccount(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const compact = toEnglishDigits(text).replace(/\s+/g, "").toUpperCase();
  if (compact.startsWith("EG")) {
    return /^EG\d{27}$/.test(compact)
      ? null
      : "رقم IBAN المصري يبدأ بـ EG ويتبعه 27 رقمًا";
  }
  return /^[A-Za-z0-9/.-]{4,34}$/.test(compact)
    ? null
    : "رقم الحساب البنكي غير صالح";
}

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

/**
 * The password checklist, mirroring `validate_password_strength` in
 * `backend/app/core/security.py` (≥8 characters, an uppercase letter, a
 * lowercase letter and a digit). Shown as a live checklist so the rule is
 * information, not a rejection: the owner sees exactly what is still missing
 * instead of discovering it when the save fails.
 */
export function passwordRequirements(value: string | null | undefined): PasswordRequirement[] {
  const text = String(value ?? "");
  return [
    { label: "8 أحرف على الأقل", met: text.length >= 8 },
    { label: "حرف كبير (A-Z)", met: /[A-Z]/.test(text) },
    { label: "حرف صغير (a-z)", met: /[a-z]/.test(text) },
    { label: "رقم واحد على الأقل", met: /\d/.test(text) },
  ];
}
