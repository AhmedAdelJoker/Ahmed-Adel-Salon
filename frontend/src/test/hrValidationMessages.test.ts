import { describe, it, expect } from "vitest";
import { validatePersonName } from "@/features/hr/utils/validators";
import { validatePhone } from "@/features/hr/utils/phone";
import { analyzeNationalId } from "@/features/hr/utils/nationalId";
import { collectEmployeeFormIssues } from "@/features/hr/utils/formIssues";
import { describeDraftAge } from "@/features/hr/utils/draft";

/**
 * The HR form's messages, in the reader's language.
 *
 * Every message used to be an Arabic sentence written into the validator, so
 * an English interface showed an Arabic error next to an English label -- and
 * the two together looked like a bug rather than a translation gap.
 *
 * The translator is optional, and that is deliberate: without one the Arabic
 * sentence stands, which is what the validators' own unit tests rely on. So
 * these tests cover both halves -- the fallback and the translation -- because
 * the fallback is what keeps the pure validators usable.
 */
const AR = {
  "hr.msg.nameRequired": "الاسم مطلوب",
  "hr.msg.phoneRequired": "رقم الجوال مطلوب",
  "hr.msg.phoneLength": "رقم الجوال غير صحيح (من 8 إلى 15 رقمًا)",
  "hr.msg.nationalIdLength": "رقم الهوية يجب أن يكون 14 رقمًا بالضبط",
} as const;

/** A translator that answers from a table, the way i18next does. */
const t = (key: string, options?: Record<string, unknown>): string => {
  const known = AR[key as keyof typeof AR];
  if (known) return known;
  return String(options?.defaultValue ?? key);
};

describe("the HR form speaks the reader's language", () => {
  it("falls back to the Arabic sentence when there is no translator", () => {
    expect(validatePersonName("")).toBe("الاسم مطلوب");
    expect(validatePhone("")).toBe("رقم الجوال مطلوب");
    expect(analyzeNationalId("123").error).toContain("14");
  });

  it("uses the translator when there is one", () => {
    expect(validatePersonName("", t)).toBe("الاسم مطلوب");
    expect(validatePhone("", t)).toBe("رقم الجوال مطلوب");
    expect(analyzeNationalId("123", t).error).toBe(
      "رقم الهوية يجب أن يكون 14 رقمًا بالضبط",
    );
  });

  it("passes the translator down to every message it collects", () => {
    // Typed-but-wrong values: an empty field is "not recorded yet", which the
    // collector deliberately does not flag.
    const issues = collectEmployeeFormIssues(
      {
        fullName: "أحمد 123",
        phonePrimary: "0100",
        nationalId: "123",
      } as never,
      t,
    );
    expect(issues.personal).toContain("رقم الجوال غير صحيح (من 8 إلى 15 رقمًا)");
    expect(issues.personal).toContain(
      "رقم الهوية يجب أن يكون 14 رقمًا بالضبط",
    );
  });

  it("keeps the fallback when no translator is given to the collector", () => {
    const issues = collectEmployeeFormIssues({
      fullName: "أحمد 123",
      phonePrimary: "0100",
    } as never);
    expect(issues.personal.length).toBeGreaterThan(0);
    expect(issues.personal.join(" ")).toContain("الاسم");
  });

  it("describes a draft's age in the reader's language", () => {
    const now = Date.now();
    const twoHoursAgo = new Date(now - 2 * 3_600_000).toISOString();
    expect(describeDraftAge(twoHoursAgo)).toBe("منذ ساعتين");
    expect(
      describeDraftAge(twoHoursAgo, (key, options) =>
        key === "hr.msg.draftTwoHours"
          ? "two hours ago"
          : String(options?.defaultValue ?? key),
      ),
    ).toBe("two hours ago");
  });
});
