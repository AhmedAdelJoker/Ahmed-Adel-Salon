/**
 * Digit handling for the employee form.
 *
 * The owner often types on an Arabic keyboard, so a phone or a national id
 * arrives as Arabic-Indic (٠١٢… \u0660-\u0669) or Persian (۰۱۲… \u06F0-\u06F9)
 * numerals. JavaScript's `\d` only matches ASCII — `"٠١٠…".replace(/[^\d]/g, "")`
 * is `""` — so every input has to be read the way its writer meant it *before*
 * anything validates or stores it. This module is that reading.
 */

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EXTENDED_ARABIC_ZERO = 0x06f0; // ۰
const ARABIC_INDIC_NINE = 0x0669;

/**
 * Every Arabic-Indic and Persian numeral becomes its ASCII digit; everything
 * else is left untouched. Used on the way in (typing) and on the way through
 * (validation), so callers never have to think about which digits they hold.
 */
export function toEnglishDigits(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const zero = code <= ARABIC_INDIC_NINE ? ARABIC_INDIC_ZERO : EXTENDED_ARABIC_ZERO;
    return String(code - zero);
  });
}

/**
 * The digits inside a value, after numerals are read as English and every
 * separator people type (spaces, dashes, parentheses, a country-code `+`) is
 * dropped. This is what validation and storage run on.
 */
export function digitsOnly(value: string | null | undefined): string {
  return toEnglishDigits(value).replace(/\D/g, "");
}

/**
 * What a numeric field holds while the user is typing: digits only, numerals
 * converted on the fly, capped so a field can never hold more digits than its
 * value could mean. Typing a fifteenth digit into a phone number does nothing
 * instead of silently producing an unsaveable value.
 */
export function normalizeNumericInput(
  value: string | null | undefined,
  maxDigits: number,
): string {
  return digitsOnly(value).slice(0, maxDigits);
}

/** Integer positions a money field can hold — enough for any payroll figure. */
export const MONEY_INT_DIGITS = 9;
/** Decimals a money field can hold; salaries are whole pounds in practice. */
export const MONEY_FRACTION_DIGITS = 2;

/**
 * What a money/percent field holds while the user is typing.
 *
 * A salary has no negative and no letters — so the minus sign simply cannot
 * be entered (typed or pasted), and everything that is not a digit or one
 * decimal point is dropped instead of shown. Numerals are read as English on
 * the way in. A leading point becomes "0." so `.5` and `‎.5` are the same
 * number, and the whole part is capped so a resting finger cannot build a
 * value the record could never mean.
 */
export function normalizeMoneyTyping(value: string | null | undefined): string {
  const english = toEnglishDigits(value);
  let cleaned = "";
  let intDigits = 0;
  let fractionDigits = 0;
  let dotSeen = false;

  for (const char of english) {
    if (char >= "0" && char <= "9") {
      if (!dotSeen) {
        if (intDigits < MONEY_INT_DIGITS) {
          cleaned += char;
          intDigits += 1;
        }
      } else if (fractionDigits < MONEY_FRACTION_DIGITS) {
        cleaned += char;
        fractionDigits += 1;
      }
    } else if ((char === "." || char === "\u066b") && !dotSeen) {
      if (cleaned === "") cleaned = "0";
      cleaned += ".";
      dotSeen = true;
    }
  }

  return cleaned;
}
