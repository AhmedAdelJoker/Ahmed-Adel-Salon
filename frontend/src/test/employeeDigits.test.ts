import { describe, it, expect } from "vitest";
import {
  toEnglishDigits,
  digitsOnly,
  normalizeNumericInput,
  normalizeMoneyTyping,
} from "@/features/hr/utils/digits";
import {
  phoneDigits,
  normalizePhoneTyping,
  validatePhone,
  MAX_PHONE_DIGITS,
} from "@/features/hr/utils/phone";

describe("toEnglishDigits", () => {
  it("reads Arabic-Indic numerals as English", () => {
    expect(toEnglishDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("reads Persian numerals as English", () => {
    expect(toEnglishDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("leaves English digits and other characters alone", () => {
    expect(toEnglishDigits("01+٢٠ abc")).toBe("01+20 abc");
  });

  it("treats nullish input as empty", () => {
    expect(toEnglishDigits(null)).toBe("");
    expect(toEnglishDigits(undefined)).toBe("");
  });
});

describe("digitsOnly", () => {
  it("keeps the digits and drops the separators", () => {
    expect(digitsOnly("٠١٠ ١٢٣-٤٥٦٧")).toBe("0101234567");
    expect(digitsOnly("+٢٠١٠٠١٢٣٤٥٦٧")).toBe("201001234567");
  });
});

describe("normalizeNumericInput", () => {
  it("converts while capping at the field's digit budget", () => {
    expect(normalizeNumericInput("٠١٠١٢٣٤٥٦٧٨٩٠١٢٣٤٥٦٧٨", 14)).toBe(
      "01012345678901",
    );
  });
});

describe("phoneDigits with Arabic keyboards", () => {
  it("understands an Arabic-Indic phone number", () => {
    expect(phoneDigits("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
  });

  it("understands Persian numerals, mixed with English and separators", () => {
    expect(phoneDigits("٠١٠ ١٢٣-٤٥٦٧۸")).toBe("01012345678");
  });

  /*
    The bug this exists for: `\d` in JavaScript is ASCII-only, so these inputs
    produced "" and the owner was told the *required* phone was missing while it
    sat on screen.
  */
  it("does not report a visible Arabic number as missing", () => {
    expect(validatePhone("٠١٠١٢٣٤٥٦٧٨")).toBeNull();
    expect(validatePhone("٠١٠١٢٣٤٥٦٧")).toMatch(/مصري/);
  });
});

describe("normalizePhoneTyping", () => {
  it("converts on the fly and refuses a sixteenth digit", () => {
    expect(normalizePhoneTyping("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
    const long = "0".repeat(MAX_PHONE_DIGITS) + "9";
    expect(normalizePhoneTyping(long)).toHaveLength(MAX_PHONE_DIGITS);
  });
});

describe("repeated-digit threshold", () => {
  it("keeps a legitimate five-run, like a real Egyptian mobile", () => {
    expect(validatePhone("01000007777")).toBeNull();
  });

  it("still catches a six-run as a typo", () => {
    expect(validatePhone("01111111111")).toMatch(/متكررة/);
  });
});

describe("normalizeMoneyTyping", () => {
  it("keeps plain digits and reads Arabic numerals", () => {
    expect(normalizeMoneyTyping("5000")).toBe("5000");
    expect(normalizeMoneyTyping("٥٠٠٠")).toBe("5000");
    expect(normalizeMoneyTyping("۵٠٠")).toBe("500");
  });

  /*
    A salary has no negative. The minus is not merely rejected by validation —
    it cannot be typed or pasted into the field at all.
  */
  it("drops the minus sign entirely", () => {
    expect(normalizeMoneyTyping("-500")).toBe("500");
    expect(normalizeMoneyTyping("-")).toBe("");
  });

  it("drops grouping, letters and spaces from a pasted value", () => {
    expect(normalizeMoneyTyping("5,000")).toBe("5000");
    expect(normalizeMoneyTyping(" abc 12 ")).toBe("12");
  });

  it("allows one decimal point with two decimals", () => {
    expect(normalizeMoneyTyping("12.5")).toBe("12.5");
    expect(normalizeMoneyTyping("12.345")).toBe("12.34");
    expect(normalizeMoneyTyping("1.2.3")).toBe("1.23");
  });

  it("turns a leading point into 0. so '.5' means 0.5", () => {
    expect(normalizeMoneyTyping(".5")).toBe("0.5");
    expect(normalizeMoneyTyping("٫٥")).toBe("0.5");
  });

  it("caps the whole part at nine digits", () => {
    expect(normalizeMoneyTyping("1234567890123")).toBe("123456789");
  });
});
