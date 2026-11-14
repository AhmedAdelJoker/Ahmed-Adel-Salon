import { describe, it, expect } from "vitest";
import { FORM_TABS } from "@/features/hr/utils/constants";

describe("employee wizard step order", () => {
  it("asks for the system role before the role-specific steps", () => {
    const ids = FORM_TABS.map((t) => t.id);
    expect(ids.indexOf("system")).toBeGreaterThan(ids.indexOf("work"));
    expect(ids.indexOf("system")).toBeLessThan(ids.indexOf("skills"));
    expect(ids.indexOf("system")).toBeLessThan(ids.indexOf("financial"));
  });

  it("starts with identity and career before anything optional", () => {
    const ids = FORM_TABS.map((t) => t.id);
    expect(ids[0]).toBe("personal");
    expect(ids[1]).toBe("work");
  });

  it("keeps every step exactly once, and review is last", () => {
    const ids = FORM_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[ids.length - 1]).toBe("documents");
  });
});