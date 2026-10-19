import { describe, it, expect } from "vitest";
import {
  collectEmployeeFormIssues,
  issuesForStep,
} from "@/features/hr/utils/formIssues";
import { defaultForm } from "@/features/hr/utils/constants";
import type { EmployeeRecord } from "@/types/employee";

function form(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return { ...(defaultForm as EmployeeRecord), ...overrides };
}

describe("collectEmployeeFormIssues", () => {
  it("finds nothing wrong with an untouched form", () => {
    const issues = collectEmployeeFormIssues(form());
    expect(Object.values(issues).every((list) => list.length === 0)).toBe(true);
  });

  it("does not flag empty required fields — that is the submit's job", () => {
    // The whole point: opening the dialog must not paint the stepper red.
    const issues = collectEmployeeFormIssues(form({ fullName: "", phonePrimary: "" }));
    expect(issues.personal).toHaveLength(0);
  });

  it("flags a typed-invalid name on the personal step", () => {
    const issues = collectEmployeeFormIssues(form({ fullName: "أحمد 123" }));
    expect(issues.personal.join(" ")).toMatch(/أرقام/);
  });

  it("flags a typed-invalid phone on the personal step", () => {
    const issues = collectEmployeeFormIssues(form({ phonePrimary: "0101234567" }));
    expect(issues.personal.join(" ")).toMatch(/مصري/);
  });

  it("accepts an Arabic-Indic phone number without complaining", () => {
    const issues = collectEmployeeFormIssues(form({ phonePrimary: "٠١٠١٢٣٤٥٦٧٨" }));
    expect(issues.personal).toHaveLength(0);
  });

  it("flags a national id that contradicts the birth date", () => {
    const issues = collectEmployeeFormIssues(
      form({ nationalId: "30001010123451", birthDate: "1999-05-05" }),
    );
    expect(issues.personal.join(" ")).toMatch(/لا يطابق/);
  });

  it("stays quiet when the birth date matches the national id", () => {
    const issues = collectEmployeeFormIssues(
      form({ nationalId: "30001010123451", birthDate: "2000-01-01" }),
    );
    expect(issues.personal).toHaveLength(0);
  });

  it("flags a contract that ends before it starts", () => {
    const issues = collectEmployeeFormIssues(
      form({ hireDate: "2026-01-01", contractEndDate: "2025-12-31" }),
    );
    expect(issues.work).toHaveLength(1);
  });

  it("flags a weak password only when an account is being made", () => {
    expect(
      collectEmployeeFormIssues(form({ hasLoginAccount: false, password: "abc" })).system,
    ).toHaveLength(0);
    const withAccount = collectEmployeeFormIssues(
      form({ hasLoginAccount: true, password: "abc" }),
    );
    expect(withAccount.system.join(" ")).toMatch(/كلمة المرور/);
  });

  it("flags an unusable username when an account is being made", () => {
    const issues = collectEmployeeFormIssues(
      form({ hasLoginAccount: true, username: "أحمد" }),
    );
    expect(issues.system.join(" ")).toMatch(/إنجليزية/);
  });

  it("flags negative money and out-of-range commission on the financial step", () => {
    const issues = collectEmployeeFormIssues(
      form({ baseSalary: -5, commissionRate: 150 }),
    );
    expect(issues.financial.join(" ")).toMatch(/بالسالب/);
    expect(issues.financial.join(" ")).toMatch(/0 إلى 100/);
  });

  it("demands a wallet number once the wallet method is chosen", () => {
    const issues = collectEmployeeFormIssues(form({ paymentMethod: "wallet" }));
    expect(issues.financial.join(" ")).toMatch(/رقم المحفظة مطلوب/);
  });

  it("does not demand a wallet number for cash", () => {
    const issues = collectEmployeeFormIssues(form({ paymentMethod: "cash" }));
    expect(issues.financial).toHaveLength(0);
  });

  it("validates a typed wallet number as a phone number", () => {
    const issues = collectEmployeeFormIssues(
      form({ paymentMethod: "wallet", walletNumber: "xyz" }),
    );
    expect(issues.financial.join(" ")).toMatch(/رقم المحفظة/);
  });
});

describe("issuesForStep", () => {
  it("answers for the review step, which is never a FormStepId", () => {
    const issues = collectEmployeeFormIssues(form());
    expect(issuesForStep(issues, "review")).toEqual([]);
    expect(issuesForStep(issues, "personal")).toEqual([]);
  });
});
