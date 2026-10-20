import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEmployeeForm } from "@/features/hr/hooks/useEmployeeForm";
import { readEmployeeDraft } from "@/features/hr/utils/draft";
import api from "@/services/api";

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
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    impl as unknown as Storage;
}

/**
 * Closing the employee form halfway through used to throw away a name, a
 * salary and a commission. The draft exists so that interrupting a payroll
 * setup does not mean retyping it.
 */
describe("the employee form draft, through the hook", () => {
  beforeEach(() => {
    installRealStorage();
    window.localStorage.clear();
    vi.clearAllMocks();
    api.get = vi.fn().mockResolvedValue({ data: [] });
    api.post = vi.fn().mockResolvedValue({ data: { id: 5 } });
    api.put = vi.fn().mockResolvedValue({ data: { id: 5 } });
  });

  it("offers nothing when there is no draft", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    expect(result.current.draftOffer).toBeNull();
  });

  it("keeps what was typed when the owner saves a draft", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    act(() =>
      result.current.setFormData((prev) => ({
        ...prev,
        fullName: "أحمد",
        baseSalary: 4500,
      })),
    );
    act(() => result.current.setActiveTab("financial"));

    act(() => {
      expect(result.current.saveDraft()).toBe(true);
    });

    const stored = readEmployeeDraft();
    expect(stored?.formData.fullName).toBe("أحمد");
    expect(stored?.formData.baseSalary).toBe(4500);
    // The step matters as much as the data: re-opening at step one of seven is
    // still most of the work redone.
    expect(stored?.activeTab).toBe("financial");
  });

  it("closes the form when a draft is saved", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    act(() =>
      result.current.setFormData((prev) => ({ ...prev, fullName: "أحمد" })),
    );
    act(() => {
      result.current.saveDraft();
    });
    expect(result.current.isModalOpen).toBe(false);
  });

  it("restores the draft where it was left", () => {
    const saved = renderHook(() => useEmployeeForm(async () => {}));
    act(() => saved.result.current.openCreate());
    act(() =>
      saved.result.current.setFormData((prev) => ({
        ...prev,
        fullName: "أحمد",
        baseSalary: 4500,
        serviceIds: [7],
      })),
    );
    act(() => saved.result.current.setActiveTab("financial"));
    act(() => {
      saved.result.current.saveDraft();
    });

    // A fresh mount is a page reload.
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    expect(result.current.draftOffer?.formData.fullName).toBe("أحمد");

    act(() => result.current.resumeDraft());

    expect(result.current.formData.fullName).toBe("أحمد");
    expect(result.current.formData.baseSalary).toBe(4500);
    expect(result.current.formData.serviceIds).toEqual([7]);
    expect(result.current.activeTab).toBe("financial");
    expect(result.current.isModalOpen).toBe(true);
  });

  it("fills in fields a draft predates rather than leaving them undefined", () => {
    // A form field added after the draft was written must not come back as
    // `undefined`, which is what a bare spread would produce.
    act(() => {
      window.localStorage.setItem(
        "employee-form-draft-v1",
        JSON.stringify({
          formData: { fullName: "قديم" },
          activeTab: "personal",
          customJobTitle: false,
          savedAt: new Date().toISOString(),
        }),
      );
    });

    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.resumeDraft());

    expect(result.current.formData.fullName).toBe("قديم");
    // Newer fields keep their defaults.
    expect(result.current.formData.phonePrimary).toBe("");
    expect(result.current.formData.employmentType).toBe("full_time");
  });

  it("throws the draft away when the owner declines it", () => {
    act(() => {
      window.localStorage.setItem(
        "employee-form-draft-v1",
        JSON.stringify({
          formData: { fullName: "أحمد" },
          activeTab: "personal",
          customJobTitle: false,
          savedAt: new Date().toISOString(),
        }),
      );
    });

    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    expect(result.current.draftOffer).not.toBeNull();

    act(() => result.current.dismissDraft());
    expect(result.current.draftOffer).toBeNull();
    expect(readEmployeeDraft()).toBeNull();
  });

  it("keeps the work and offers it back after an interrupted attempt", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    act(() =>
      result.current.setFormData((prev) => ({ ...prev, fullName: "أحمد" })),
    );

    // Closing without pressing "save draft": the work is in component state, not
    // in storage, and losing it is the whole problem.
    act(() => result.current.keepDraftOnClose());
    act(() => result.current.setIsModalOpen(false));

    expect(readEmployeeDraft()?.formData.fullName).toBe("أحمد");

    // A fresh mount is a page reload: the draft comes back as an offer.
    const { result: next } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => next.current.openCreate());
    expect(next.current.draftOffer?.formData.fullName).toBe("أحمد");
  });

  it("does not nag about an untouched form that was closed straight away", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    act(() => result.current.keepDraftOnClose());
    act(() => result.current.setIsModalOpen(false));
    expect(readEmployeeDraft()).toBeNull();

    const { result: next } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => next.current.openCreate());
    expect(next.current.draftOffer).toBeNull();
  });

  it("does not draft an edit, which has a saved row to fall back on", async () => {
    api.get = vi.fn().mockResolvedValue({
      data: { id: 9, fullName: "موظف", phonePrimary: "01001234567" },
    });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    await act(async () => {
      await result.current.openEdit({ id: 9 });
    });
    act(() =>
      result.current.setFormData((prev) => ({ ...prev, fullName: "معدّل" })),
    );
    act(() => {
      expect(result.current.saveDraft()).toBe(false);
    });
    expect(readEmployeeDraft()).toBeNull();
  });

  it("removes the draft once the employee is saved", async () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.openCreate());
    act(() =>
      result.current.setFormData((prev) => ({
        ...prev,
        fullName: "أحمد",
        phonePrimary: "01001234567",
      })),
    );
    act(() => {
      result.current.saveDraft();
    });
    expect(readEmployeeDraft()).not.toBeNull();

    // Re-opening starts a clean form, so refill it as a real second attempt.
    act(() => result.current.openCreate());
    act(() =>
      result.current.setFormData((prev) => ({
        ...prev,
        fullName: "أحمد",
        phonePrimary: "01001234567",
      })),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });

    // Leaving a draft behind would create the same person twice on the next
    // resume.
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(readEmployeeDraft()).toBeNull();
  });
});