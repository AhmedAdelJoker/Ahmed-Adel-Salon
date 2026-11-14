import { describe, it, expect } from "vitest";
import {
  validatePersonName,
  validateUsername,
  validateMoney,
  validateCommission,
  validateBankAccount,
  passwordRequirements,
  MONEY_MAX,
} from "@/features/hr/utils/validators";

describe("validatePersonName", () => {
  it("accepts real Arabic and Latin names", () => {
    expect(validatePersonName("أحمد محمد عبد الله")).toBeNull();
    expect(validatePersonName("Ahmed Adel")).toBeNull();
    expect(validatePersonName("Jean-Luc O'Brien")).toBeNull();
    expect(validatePersonName("عبد الرحمن الشاذلي")).toBeNull();
  });

  it("requires a name at all", () => {
    expect(validatePersonName("")).toBe("الاسم مطلوب");
    expect(validatePersonName("   ")).toBe("الاسم مطلوب");
  });

  it("rejects a one-letter name", () => {
    expect(validatePersonName("م")).toMatch(/قصير/);
  });

  it("rejects digits, English or Arabic", () => {
    expect(validatePersonName("أحمد 123")).toMatch(/أرقام/);
    expect(validatePersonName("أحمد ٣")).toMatch(/أرقام/);
  });

  it("rejects symbols that have no business in a name", () => {
    expect(validatePersonName("أحمد@#")).toMatch(/رموز/);
  });

  it("rejects an absurdly long name instead of storing it", () => {
    expect(validatePersonName("ا".repeat(101))).toMatch(/طويل/);
  });
});

describe("validateUsername", () => {
  it("accepts a normal credential", () => {
    expect(validateUsername("ahmed.hr_01")).toBeNull();
  });

  it("rejects an Arabic username, which could never log in", () => {
    expect(validateUsername("أحمد")).toMatch(/إنجليزية/);
  });

  it("enforces the length range", () => {
    expect(validateUsername("ab")).toMatch(/3 أحرف/);
    expect(validateUsername("a".repeat(31))).toMatch(/30/);
  });

  it("requires a value at all", () => {
    expect(validateUsername("")).toMatch(/مطلوب/);
  });
});

describe("validateMoney", () => {
  it("accepts zero and ordinary amounts", () => {
    expect(validateMoney(0, "الراتب")).toBeNull();
    expect(validateMoney(7500, "الراتب")).toBeNull();
    expect(validateMoney("", "الراتب")).toBeNull();
  });

  it("rejects negatives", () => {
    expect(validateMoney(-1, "الراتب")).toMatch(/بالسالب/);
  });

  it("rejects nonsense input", () => {
    expect(validateMoney("abc", "الراتب")).toMatch(/رقم/);
  });

  it("rejects amounts past the ceiling", () => {
    expect(validateMoney(MONEY_MAX + 1, "الراتب")).toMatch(/يتجاوز/);
  });
});

describe("validateCommission", () => {
  it("accepts percentages in range", () => {
    expect(validateCommission(0)).toBeNull();
    expect(validateCommission(50)).toBeNull();
    expect(validateCommission(100)).toBeNull();
  });

  it("rejects anything outside 0–100", () => {
    expect(validateCommission(101)).toMatch(/0 إلى 100/);
    expect(validateCommission(-5)).toMatch(/0 إلى 100/);
  });
});

describe("validateBankAccount", () => {
  it("treats empty as 'not recorded'", () => {
    expect(validateBankAccount("")).toBeNull();
  });

  it("checks an Egyptian IBAN for the EG + 27 digits shape", () => {
    expect(validateBankAccount("EG380019000500000000263180002")).toBeNull();
    expect(validateBankAccount("EG123")).toMatch(/IBAN/);
  });

  it("accepts a plain account number and rejects refuse", () => {
    expect(validateBankAccount("1234-5678 90")).toBeNull();
    expect(validateBankAccount("!!")).toMatch(/غير صالح/);
  });
});

describe("passwordRequirements", () => {
  it("marks everything met for a compliant password", () => {
    expect(passwordRequirements("Barber2026").every((r) => r.met)).toBe(true);
  });

  it("names what is missing, one line at a time", () => {
    const reqs = passwordRequirements("abc");
    expect(reqs.find((r) => r.label.includes("8"))?.met).toBe(false);
    expect(reqs.find((r) => r.label.includes("A-Z"))?.met).toBe(false);
    expect(reqs.find((r) => r.label.includes("a-z"))?.met).toBe(true);
    expect(reqs.find((r) => r.label.includes("رقم"))?.met).toBe(false);
  });
});
