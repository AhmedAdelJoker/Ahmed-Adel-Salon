import { describe, it, expect } from "vitest";
import {
  phoneDigits,
  validatePhone,
  isSamePhone,
  findPhoneConflict,
} from "@/features/hr/utils/phone";

describe("phoneDigits", () => {
  it("keeps only digits", () => {
    expect(phoneDigits("01001234567")).toBe("01001234567");
    expect(phoneDigits("0100 123 4567")).toBe("01001234567");
    expect(phoneDigits("0100-123-4567")).toBe("01001234567");
    expect(phoneDigits("(010) 123 4567")).toBe("0101234567");
    expect(phoneDigits("+201001234567")).toBe("201001234567");
  });

  it("treats empty and nullish input as no digits", () => {
    expect(phoneDigits("")).toBe("");
    expect(phoneDigits(null)).toBe("");
    expect(phoneDigits(undefined)).toBe("");
    expect(phoneDigits("   ")).toBe("");
    expect(phoneDigits("abc")).toBe("");
  });
});

describe("validatePhone", () => {
  it("accepts a plain Egyptian mobile", () => {
    expect(validatePhone("01001234567")).toBeNull();
  });

  it("accepts the same number however it is typed", () => {
    expect(validatePhone("0100 123 4567")).toBeNull();
    expect(validatePhone("0100-123-4567")).toBeNull();
    expect(validatePhone("+201001234567")).toBeNull();
  });

  it("requires a number at all", () => {
    expect(validatePhone("")).toBe("رقم الجوال مطلوب");
    expect(validatePhone(null)).toBe("رقم الجوال مطلوب");
  });

  it("rejects a number that is too short", () => {
    expect(validatePhone("0101234")).toMatch(/8 إلى 15/);
  });

  it("rejects a number that is too long", () => {
    expect(validatePhone("0100123456789012")).toMatch(/8 إلى 15/);
  });

  it("catches a repeated-digit slip, which is how typos actually happen", () => {
    expect(validatePhone("01111111111")).toMatch(/متكررة/);
    expect(validatePhone("00000000000")).toMatch(/متكررة/);
  });

  it("names the Egyptian rule when the number looks Egyptian but is not", () => {
    // Starts 01, but 10 digits instead of 11.
    expect(validatePhone("0101234567")).toMatch(/مصري/);
  });

  it("rejects a bare local prefix", () => {
    expect(validatePhone("01")).toMatch(/غير صحيح/);
    expect(validatePhone("0")).toMatch(/غير صحيح/);
  });

  it("does not call a valid international number Egyptian", () => {
    // 44 is the UK country code: long enough, does not start 01, so it passes.
    expect(validatePhone("447700900123")).toBeNull();
  });
});

describe("isSamePhone", () => {
  it("matches despite formatting", () => {
    expect(isSamePhone("01001234567", "0100 123 4567")).toBe(true);
  });

  it("matches a national number against its country-coded form", () => {
    expect(isSamePhone("01001234567", "+201001234567")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(isSamePhone("01001234567", "01001234568")).toBe(false);
  });

  it("does not match an empty side", () => {
    expect(isSamePhone("", "01001234567")).toBe(false);
    expect(isSamePhone("01001234567", null)).toBe(false);
  });
});

describe("findPhoneConflict", () => {
  const roster = [
    { id: 1, fullName: "أحمد", phonePrimary: "01001234567" },
    { id: 2, fullName: "سارة", phonePrimary: "01119876543" },
  ];

  it("finds the employee who already holds the number", () => {
    const conflict = findPhoneConflict("0100 123 4567", roster);
    expect(conflict?.id).toBe(1);
    expect(conflict?.name).toBe("أحمد");
  });

  it("returns null for a number nobody holds", () => {
    expect(findPhoneConflict("01555555555", roster)).toBeNull();
  });

  it("ignores the employee being edited, so keeping your own number is fine", () => {
    expect(findPhoneConflict("01001234567", roster, 1)).toBeNull();
    expect(findPhoneConflict("01001234567", roster, 2)?.id).toBe(1);
  });

  it("reports a usable name even when the row has none", () => {
    const conflict = findPhoneConflict("01001234567", [
      { id: 7, fullName: null, phonePrimary: "01001234567" },
    ]);
    expect(conflict?.name).toBeTruthy();
  });

  it("tolerates a missing roster rather than throwing", () => {
    expect(findPhoneConflict("01001234567", undefined as never)).toBeNull();
    expect(findPhoneConflict("", roster)).toBeNull();
  });
});