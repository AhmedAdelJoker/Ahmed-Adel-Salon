import { describe, it, expect, beforeEach } from "vitest";
import {
  EMPLOYEE_DRAFT_STORAGE_KEY,
  readEmployeeDraft,
  writeEmployeeDraft,
  clearEmployeeDraft,
  isDraftWorthResuming,
  describeDraftAge,
} from "@/features/hr/utils/draft";

/**
 * The employee form is seven steps holding a name, a phone, a salary and a
 * commission. Closing it used to discard all of that, which meant the owner
 * could not open the form "just to check something" without risking what they
 * had typed.
 *
 * The global `localStorage` stub in `setup.ts` is a set of `vi.fn()`s that do
 * nothing, so it cannot show whether a value survives a write. Swap in a real
 * map for this file; everything under test is ordinary storage behaviour.
 */
function installRealStorage() {
  const store = new Map<string, string>();
  const impl = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: impl,
    configurable: true,
    writable: true,
  });
  // The module reads `window.localStorage`; the global mock is what `clear()`
  // was hitting above.
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    impl as unknown as Storage;
}

describe("the employee form draft", () => {
  beforeEach(() => {
    installRealStorage();
    window.localStorage.clear();
  });

  it("round-trips what was typed", () => {
    expect(
      writeEmployeeDraft({
        formData: { fullName: "أحمد", phonePrimary: "01001234567" },
        activeTab: "financial",
        customJobTitle: false,
      }),
    ).toBe(true);

    const draft = readEmployeeDraft();
    expect(draft?.formData.fullName).toBe("أحمد");
    expect(draft?.activeTab).toBe("financial");
    expect(typeof draft?.savedAt).toBe("string");
  });

  it("is absent until something is written", () => {
    expect(readEmployeeDraft()).toBeNull();
  });

  it("can be thrown away", () => {
    writeEmployeeDraft({
      formData: { fullName: "أحمد" },
      activeTab: "personal",
      customJobTitle: false,
    });
    clearEmployeeDraft();
    expect(readEmployeeDraft()).toBeNull();
  });

  it("survives a corrupt value instead of taking the HR page down", () => {
    // A hand-edited or half-written entry used to throw during render, which
    // would blank the whole page rather than just lose the draft.
    window.localStorage.setItem(EMPLOYEE_DRAFT_STORAGE_KEY, "{not json");
    expect(readEmployeeDraft()).toBeNull();

    window.localStorage.setItem(EMPLOYEE_DRAFT_STORAGE_KEY, JSON.stringify({ nope: 1 }));
    expect(readEmployeeDraft()).toBeNull();

    window.localStorage.setItem(EMPLOYEE_DRAFT_STORAGE_KEY, JSON.stringify("a string"));
    expect(readEmployeeDraft()).toBeNull();
  });

  it("falls back to the first step when the saved one is nonsense", () => {
    window.localStorage.setItem(
      EMPLOYEE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        formData: { fullName: "أحمد" },
        activeTab: 42,
        savedAt: new Date().toISOString(),
      }),
    );
    expect(readEmployeeDraft()?.activeTab).toBe("personal");
  });

  it("reports a draft that holds nothing as not worth resuming", () => {
    // Otherwise every "add employee" that was opened and closed straight away
    // would start with a prompt offering to restore an empty form.
    expect(isDraftWorthResuming(null)).toBe(false);
    expect(
      isDraftWorthResuming(
        writeAndRead({ fullName: "", phonePrimary: "", baseSalary: 0, jobTitle: "barber" }),
      ),
    ).toBe(false);
  });

  it("offers to resume once a real detail is present", () => {
    expect(isDraftWorthResuming(writeAndRead({ fullName: "أحمد" }))).toBe(true);
    expect(isDraftWorthResuming(writeAndRead({ email: "a@b.com" }))).toBe(true);
    expect(isDraftWorthResuming(writeAndRead({ username: "ahmed" }))).toBe(true);
    expect(isDraftWorthResuming(writeAndRead({ nationalId: "2990101" }))).toBe(true);
  });

  it("offers to resume for a salary or a chosen service", () => {
    expect(isDraftWorthResuming(writeAndRead({ baseSalary: 4000 }))).toBe(true);
    expect(isDraftWorthResuming(writeAndRead({ commissionRate: 15 }))).toBe(true);
    expect(isDraftWorthResuming(writeAndRead({ serviceIds: [1, 2] }))).toBe(true);
  });

  it("offers to resume when the owner picked a non-default job title", () => {
    expect(isDraftWorthResuming(writeAndRead({ jobTitle: "colorist" }))).toBe(true);
    expect(isDraftWorthResuming(writeAndRead({ jobTitle: "barber" }))).toBe(false);
  });

  it("does not treat whitespace as content", () => {
    expect(isDraftWorthResuming(writeAndRead({ fullName: "   " }))).toBe(false);
  });

  it("describes the age of a draft in words", () => {
    const now = Date.now();
    expect(describeDraftAge(new Date(now - 30_000).toISOString())).toBe("الآن");
    expect(describeDraftAge(new Date(now - 5 * 60_000).toISOString())).toContain("5");
    expect(describeDraftAge(new Date(now - 60 * 60_000).toISOString())).toBe("منذ ساعة");
    expect(describeDraftAge(new Date(now - 5 * 3_600_000).toISOString())).toContain("ساعات");
    expect(describeDraftAge(new Date(now - 26 * 3_600_000).toISOString())).toBe("أمس");
    expect(describeDraftAge(new Date(now - 3 * 86_400_000).toISOString())).toBe("منذ 3 أيام");
    expect(describeDraftAge(new Date(now - 40 * 86_400_000).toISOString())).toContain("شهر");
  });

  it("says nothing rather than NaN for an unreadable timestamp", () => {
    expect(describeDraftAge("not-a-date")).toBe("");
  });
});

function writeAndRead(formData: Record<string, unknown>) {
  writeEmployeeDraft({ formData, activeTab: "personal", customJobTitle: false });
  return readEmployeeDraft();
}