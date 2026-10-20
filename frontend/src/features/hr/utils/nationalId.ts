/**
 * Egyptian national id ("الرقم القومي") validation.
 *
 * The id is 14 digits and is not opaque: it encodes the century and birth date
 * (C YY MM DD), the governorate it was issued in, a serial and a check digit.
 * Two of the records already on this machine are impossible — one is 13 digits,
 * the other embeds the 84th day of a month — which is exactly what happens when
 * the field is treated as free text. The rules below make that impossible going
 * forward, and the parse doubles as a courtesy: a valid id fills in the birth
 * date the owner would otherwise type by hand.
 *
 * The final check digit is deliberately NOT verified: the algorithm is not
 * published, implementations disagree, and rejecting a real id is worse than
 * accepting a fabricated one. Structure, a real calendar date and a real
 * governorate catch every mistake a human actually makes.
 */
import { digitsOnly } from "./digits";

export const NATIONAL_ID_LENGTH = 14;

/** Issuing governorates, keyed by the 8th–9th digits. 88 = born abroad. */
export const GOVERNORATE_NAMES: Record<string, string> = {
  "01": "القاهرة",
  "02": "الإسكندرية",
  "03": "بورسعيد",
  "04": "السويس",
  "05": "دمياط",
  "06": "الدقهلية",
  "07": "الشرقية",
  "08": "القليوبية",
  "09": "كفر الشيخ",
  "10": "الغربية",
  "11": "المنوفية",
  "12": "البحيرة",
  "13": "الإسماعيلية",
  "14": "الجيزة",
  "15": "بني سويف",
  "16": "الفيوم",
  "17": "المنيا",
  "18": "أسيوط",
  "19": "سوهاج",
  "20": "قنا",
  "21": "أسوان",
  "22": "الأقصر",
  "23": "البحر الأحمر",
  "24": "الوادي الجديد",
  "25": "مطروح",
  "26": "شمال سيناء",
  "27": "جنوب سيناء",
  "88": "خارج الجمهورية",
};

export interface NationalIdInfo {
  /** `yyyy-mm-dd`, ready for an `<input type="date">`. */
  birthDate: string;
  governorateCode: string;
  governorateName: string;
}

export interface NationalIdAnalysis {
  /** The value's digits after numeral conversion. */
  digits: string;
  /** An error message, or null when empty/valid. Empty is "absent", not "wrong". */
  error: string | null;
  /** Present only when the id is valid. */
  info: NationalIdInfo | null;
}

/**
 * Validate and decode in one pass, so the field can show an error and the form
 * can prefill the birth date from the same answer.
 */
export function analyzeNationalId(
  value: string | null | undefined,
): NationalIdAnalysis {
  const digits = digitsOnly(value);

  // Optional field: blank means "not recorded", which is legal.
  if (!digits) return { digits, error: null, info: null };

  if (digits.length !== NATIONAL_ID_LENGTH) {
    return {
      digits,
      error: `رقم الهوية يجب أن يكون ${NATIONAL_ID_LENGTH} رقمًا بالضبط`,
      info: null,
    };
  }

  const century = digits[0];
  if (century !== "2" && century !== "3") {
    return {
      digits,
      error: "رقم الهوية غير صحيح: أول رقم يجب أن يكون 2 أو 3",
      info: null,
    };
  }

  // C YY MM DD — century 2 = 1900s, 3 = 2000s.
  const year = (century === "2" ? 1900 : 2000) + Number(digits.slice(1, 3));
  const month = Number(digits.slice(3, 5));
  const day = Number(digits.slice(5, 7));

  // A real calendar date; day 84 and month 13 are how a fake id gives itself away.
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!isRealDate) {
    return {
      digits,
      error: "رقم الهوية يحتوي على تاريخ ميلاد غير صحيح",
      info: null,
    };
  }

  const governorateCode = digits.slice(7, 9);
  const numericCode = Number(governorateCode);
  if (!(governorateCode in GOVERNORATE_NAMES) && !(numericCode >= 1 && numericCode <= 35)) {
    return {
      digits,
      error: "رقم الهوية يحتوي على كود محافظة غير معروف",
      info: null,
    };
  }

  return {
    digits,
    error: null,
    info: {
      birthDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      governorateCode,
      governorateName:
        GOVERNORATE_NAMES[governorateCode] ?? `محافظة ${governorateCode}`,
    },
  };
}

/** The error alone, for validators that only need a yes/no. */
export function validateNationalId(value: string | null | undefined): string | null {
  return analyzeNationalId(value).error;
}

export interface NationalIdConflict {
  id: string | number;
  name: string;
}

/**
 * Find an existing employee already holding this national id, comparing digits
 * so the same id typed in different numeral systems is still one person.
 */
export function findNationalIdConflict(
  value: string | null | undefined,
  candidates: Array<{ id: string | number; fullName?: string | null; nationalId?: string | null }>,
  excludeId?: string | number | null,
): NationalIdConflict | null {
  const digits = digitsOnly(value);
  if (!digits) return null;

  const skipId = excludeId == null ? null : String(excludeId);
  for (const emp of candidates ?? []) {
    if (!emp) continue;
    if (skipId != null && String(emp.id) === skipId) continue;
    if (digitsOnly(emp.nationalId) === digits) {
      return { id: emp.id, name: emp.fullName || "موظف موجود" };
    }
  }
  return null;
}
