import { describe, it, expect } from "vitest";
import {
  visibleFormTabs,
  hiddenFormSteps,
  isFormStepVisible,
  FORM_STEP_RULES,
} from "@/features/hr/utils/constants";
import { validateEmployeeEmail } from "@/features/hr/utils/phone";

describe("which steps a job title asks for", () => {
  it("offers skills to the service-giving roles", () => {
    for (const title of ["barber", "colorist", "esthetician"]) {
      expect(isFormStepVisible("skills", title), title).toBe(true);
    }
  });

  it("hides skills from everyone else", () => {
    for (const title of ["manager", "accountant", "cashier", "receptionist", "cleaner", "barber_assistant", "owner", "other", ""]) {
      expect(isFormStepVisible("skills", title), title).toBe(false);
    }
  });

  it("offers the assistant step only to an assistant", () => {
    expect(isFormStepVisible("assistant", "barber_assistant")).toBe(true);
    expect(isFormStepVisible("assistant", "barber")).toBe(false);
  });

  it("never hides identity, career, system, financial or documents", () => {
    for (const title of ["manager", "barber", "barber_assistant", "other", ""]) {
      for (const step of ["personal", "work", "system", "financial", "documents"] as const) {
        expect(isFormStepVisible(step, title), `${step}/${title}`).toBe(true);
      }
    }
  });

  it("keeps the visible steps in the declared order", () => {
    expect(visibleFormTabs("barber").map((t) => t.id)).toEqual([
      "personal",
      "work",
      "system",
      "skills",
      "financial",
      "documents",
    ]);
  });

  it("drops exactly the role-specific steps for a manager", () => {
    expect(visibleFormTabs("manager").map((t) => t.id)).toEqual([
      "personal",
      "work",
      "system",
      "financial",
      "documents",
    ]);
  });

  it("treats an unset job title as no role-specific step", () => {
    expect(visibleFormTabs(undefined).map((t) => t.id)).not.toContain("skills");
    expect(visibleFormTabs(null).map((t) => t.id)).not.toContain("assistant");
  });
});

describe("explaining the steps that were dropped", () => {
  it("names each hidden step with a reason", () => {
    const hidden = hiddenFormSteps("manager");
    const ids = hidden.map((s) => s.id);
    expect(ids).toContain("skills");
    expect(ids).toContain("assistant");
    for (const step of hidden) {
      expect(step.reason.length, step.id).toBeGreaterThan(0);
      expect(step.label.length, step.id).toBeGreaterThan(0);
    }
  });

  it("reports nothing hidden for a role that sees everything applicable", () => {
    expect(hiddenFormSteps("barber").map((s) => s.id)).toEqual(["assistant"]);
  });

  it("has a reason declared for every step it can hide", () => {
    for (const [stepId, rule] of Object.entries(FORM_STEP_RULES)) {
      expect(rule.reason.length, stepId).toBeGreaterThan(0);
      expect(rule.jobTitles.length, stepId).toBeGreaterThan(0);
    }
  });
});

describe("validateEmployeeEmail", () => {
  it("accepts an ordinary address", () => {
    expect(validateEmployeeEmail("ahmed@example.com")).toBeNull();
    expect(validateEmployeeEmail("ahmed.salah@salon.co.eg")).toBeNull();
  });

  it("treats an empty address as required rather than invalid", () => {
    expect(validateEmployeeEmail("")).toBe("البريد الإلكتروني مطلوب");
  });

  it("rejects a value with no @", () => {
    expect(validateEmployeeEmail("not-an-address")).toBe("البريد الإلكتروني غير صالح");
  });

  it("rejects two @ signs", () => {
    expect(validateEmployeeEmail("a@b@example.com")).toBe("البريد الإلكتروني غير صالح");
  });

  it("rejects a domain with no dot", () => {
    expect(validateEmployeeEmail("ahmed@localhost")).toBe("البريد الإلكتروني غير صالح");
  });

  it("rejects a missing local part or domain", () => {
    expect(validateEmployeeEmail("@example.com")).toBe("البريد الإلكتروني غير صالح");
    expect(validateEmployeeEmail("ahmed@")).toBe("البريد الإلكتروني غير صالح");
  });

  it("rejects whitespace anywhere", () => {
    expect(validateEmployeeEmail("ahmed @example.com")).toBe("البريد الإلكتروني غير صالح");
    expect(validateEmployeeEmail("ahmed@exa mple.com")).toBe("البريد الإلكتروني غير صالح");
  });

  it("rejects a leading or trailing dot in the domain", () => {
    expect(validateEmployeeEmail("ahmed@example.com.")).toBe("البريد الإلكتروني غير صالح");
    expect(validateEmployeeEmail("ahmed@.example.com")).toBe("البريد الإلكتروني غير صالح");
  });

  it("trims before judging", () => {
    expect(validateEmployeeEmail("  ahmed@example.com  ")).toBeNull();
  });
});