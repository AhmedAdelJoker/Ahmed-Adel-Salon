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
 *
 * Every message is available in the reader's language. The translator is
 * optional: without one the Arabic sentence is used, so the pure validators
 * keep working where no language is in scope (tests, the server-side mirror).
 */
import { toEnglishDigits } from "./digits";

/**
 * The translator the validators use, when one is available.
 *
 * `t` is the i18next `t` narrowed to what is used here: a key, optional
 * values, and a string back.
 */
export type ValidatorTranslate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export const NAME_MIN = 2;
export const NAME_MAX = 100;
export const MONEY_MAX = 1_000_000;

/** Arabic-Indic, Persian and ASCII digits — a name carries none of them. */
const NAME_DIGIT_RE = /[0-9\u0660-\u06f9\u06f0-\u06f9]/;

/**
 * Letters (any script), combining marks, spaces and the punctuation real names
 * carry: "محمد عبد الله", "Jean-Luc", "O'Brien", "عبد الرحمن الشاذلي".
 */
const NAME_ALLOWED_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;

export function validatePersonName(
  value: string | null | undefined,
  t?: ValidatorTranslate,
): string | null {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");

  if (!text) return msg(t, "nameRequired", "الاسم مطلوب");
  if (text.length < NAME_MIN) return msg(t, "nameTooShort", "الاسم قصير جدًا");
  if (text.length > NAME_MAX) {
    return msg(t, "nameTooLong", "الاسم طويل جدًا ({{max}} حرف كحد أقصى)", {
      max: NAME_MAX,
    });
  }
  if (NAME_DIGIT_RE.test(text)) {
    return msg(t, "nameHasDigits", "الاسم لا يمكن أن يحتوي على أرقام");
  }
  if (!NAME_ALLOWED_RE.test(text)) {
    return msg(t, "nameInvalidChars", "الاسم يحتوي على رموز غير مسموحة");
  }

  return null;
}

/**
 * Usernames are credentials, not display names: ASCII letters, digits and
 * `. _ -` only, 3–30 characters. The backend authenticates with them, so an
 * Arabic username would type fine and fail at every login.
 */
export function validateUsername(
  value: string | null | undefined,
  t?: ValidatorTranslate,
): string | null {
  const text = String(value ?? "").trim();

  if (!text) return msg(t, "usernameRequired", "اسم المستخدم مطلوب");
  if (text.length < 3) {
    return msg(t, "usernameTooShort", "اسم المستخدم 3 أحرف على الأقل");
  }
  if (text.length > 30) {
    return msg(t, "usernameTooLong", "اسم المستخدم 30 حرفًا كحد أقصى");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(text)) {
    return msg(
      t,
      "usernameInvalidChars",
      "اسم المستخدم: حروف إنجليزية وأرقام و . _ - فقط",
    );
  }

  return null;
}

/** A money field: non-negative and within the store's sanity ceiling. */
export function validateMoney(
  value: unknown,
  label: string,
  t?: ValidatorTranslate,
): string | null {
  if (value === "" || value == null) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return msg(t, "moneyNotNumber", "{{label}} يجب أن يكون رقمًا", { label });
  }
  if (num < 0) {
    return msg(t, "moneyNegative", "{{label}} لا يمكن أن يكون بالسالب", { label });
  }
  if (num > MONEY_MAX) {
    return msg(
      t,
      "moneyTooHigh",
      "{{label}} يتجاوز الحد الأقصى ({{max}})",
      { label, max: MONEY_MAX.toLocaleString("en-US") },
    );
  }

  return null;
}

/** Commission rates are percentages: 0–100, nothing outside. */
export function validateCommission(
  value: unknown,
  t?: ValidatorTranslate,
): string | null {
  if (value === "" || value == null) return null;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return msg(t, "commissionNotNumber", "نسبة العمولة يجب أن تكون رقمًا");
  }
  if (num < 0 || num > 100) {
    return msg(t, "commissionRange", "نسبة العمولة من 0 إلى 100%");
  }

  return null;
}

/**
 * A bank account. Egyptian IBANs start with `EG` and carry 27 digits after it;
 * anything else is treated as a local account number — letters, digits and
 * separators, 4–34 characters. Loose on purpose: banks format account numbers
 * differently, and rejecting a real one is worse than accepting a stray dash.
 */
export function validateBankAccount(
  value: string | null | undefined,
  t?: ValidatorTranslate,
): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const compact = toEnglishDigits(text).replace(/\s+/g, "").toUpperCase();
  if (compact.startsWith("EG")) {
    return /^EG\d{27}$/.test(compact)
      ? null
      : msg(
          t,
          "ibanInvalid",
          "رقم IBAN المصري يبدأ بـ EG ويتبعه 27 رقمًا",
        );
  }
  return /^[A-Za-z0-9/.-]{4,34}$/.test(compact)
    ? null
    : msg(t, "bankInvalid", "رقم الحساب البنكي غير صالح");
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
export function passwordRequirements(
  value: string | null | undefined,
  t?: ValidatorTranslate,
): PasswordRequirement[] {
  const text = String(value ?? "");
  return [
    { label: msg(t, "passwordMinLength", "8 أحرف على الأقل"), met: text.length >= 8 },
    { label: msg(t, "passwordUppercase", "حرف كبير (A-Z)"), met: /[A-Z]/.test(text) },
    { label: msg(t, "passwordLowercase", "حرف صغير (a-z)"), met: /[a-z]/.test(text) },
    { label: msg(t, "passwordDigit", "رقم واحد على الأقل"), met: /\d/.test(text) },
  ];
}

/**
 * One message, in the reader's language when there is one.
 *
 * The Arabic sentence stays in the code as the fallback: the validators are
 * used where no language is in scope, and a validator that cannot speak
 * returns nothing is a validator that does not work.
 */
function msg(
  t: ValidatorTranslate | undefined,
  key: string,
  fallback: string,
  values?: Record<string, unknown>,
): string {
  if (!t) return interpolate(fallback, values);
  return t(`hr.msg.${key}`, { defaultValue: fallback, ...(values ?? {}) });
}

/** `{{name}}` placeholders, for the fallback path only. */
function interpolate(
  template: string,
  values?: Record<string, unknown>,
): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
