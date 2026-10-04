import { describe, expect, it } from "vitest";
import {
  errorHeadline,
  isConflict,
  toErrorLines,
} from "@/lib/core/apiErrors";

const asError = (status: number, data: unknown) =>
  ({ response: { status, data } }) as unknown;

describe("toErrorLines", () => {
  it("passes a plain string detail through", () => {
    const lines = toErrorLines(asError(400, { detail: "مدة الدوام قصيرة جداً" }), "fallback");
    expect(lines).toEqual([{ message: "مدة الدوام قصيرة جداً" }]);
  });

  it("returns every 422 entry, not just the first", () => {
    const error = asError(422, {
      detail: [
        { loc: ["body", "working_hours"], msg: "صيغة الوقت غير صحيحة", type: "value_error" },
        { loc: ["body", "salon_name"], msg: "field required", type: "missing" },
        { loc: ["body", "currency"], msg: "String too long", type: "string_too_long" },
      ],
    });
    const lines = toErrorLines(error, "fallback");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ field: "ساعات العمل", message: "صيغة الوقت غير صحيحة" });
    expect(lines[1]).toEqual({ field: "اسم المنشأة", message: "حقل مطلوب" });
    expect(lines[2]).toEqual({ field: "العملة", message: "القيمة طويلة جداً" });
  });

  it("strips pydantic's Value error prefix", () => {
    const error = asError(422, {
      detail: [
        { loc: ["body", "working_hours"], msg: "Value error, وقت الإغلاق غير صحيح", type: "x" },
      ],
    });
    expect(toErrorLines(error, "fallback")[0].message).toBe("وقت الإغلاق غير صحيح");
  });

  it("humanises underscores in raw messages", () => {
    const error = asError(422, {
      detail: [{ loc: ["body", "x"], msg: "some_field is invalid", type: "x" }],
    });
    expect(toErrorLines(error, "fallback")[0].message).toBe("some field is invalid");
  });

  it("deduplicates identical entries", () => {
    const error = asError(422, {
      detail: [
        { loc: ["body", "a"], msg: "same", type: "x" },
        { loc: ["body", "b"], msg: "same", type: "x" },
      ],
    });
    const lines = toErrorLines(error, "fallback");
    expect(lines).toHaveLength(2);
  });

  it("handles string entries inside detail", () => {
    const error = asError(422, { detail: ["  ", "خطأ واحد"] });
    expect(toErrorLines(error, "fallback")).toEqual([{ message: "خطأ واحد" }]);
  });

  it("falls back for a non-422 shape", () => {
    expect(toErrorLines(asError(500, {}), "فشل الحفظ")).toEqual([{ message: "فشل الحفظ" }]);
  });

  it("falls back for a null error", () => {
    expect(toErrorLines(null, "فشل الحفظ")).toEqual([{ message: "فشل الحفظ" }]);
  });

  it("uses the Error message when it is not a status code echo", () => {
    expect(toErrorLines(new Error("Network Error"), "فشل الحفظ")).toEqual([
      { message: "Network Error" },
    ]);
  });

  it("ignores a bare status-code message", () => {
    const error = new Error("Request failed with status code 500");
    expect(toErrorLines(error, "فشل الحفظ")).toEqual([{ message: "فشل الحفظ" }]);
  });
});

describe("isConflict", () => {
  it("detects 409", () => {
    expect(isConflict(asError(409, {}))).toBe(true);
  });

  it("rejects other statuses", () => {
    expect(isConflict(asError(400, {}))).toBe(false);
    expect(isConflict(asError(422, {}))).toBe(false);
    expect(isConflict(new Error("boom"))).toBe(false);
  });
});

describe("errorHeadline", () => {
  it("shows the single message verbatim", () => {
    expect(errorHeadline([{ message: "خطأ" }], "fallback")).toBe("خطأ");
  });

  it("counts the extra errors", () => {
    const lines = [{ message: "أول" }, { message: "ثاني" }, { message: "ثالث" }];
    expect(errorHeadline(lines, "fallback")).toBe("أول (+2 خطأ آخر)");
  });

  it("falls back for an empty list", () => {
    expect(errorHeadline([], "fallback")).toBe("fallback");
  });
});
