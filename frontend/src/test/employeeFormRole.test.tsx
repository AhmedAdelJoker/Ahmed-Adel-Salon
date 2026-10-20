import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEmployeeForm } from "@/features/hr/hooks/useEmployeeForm";
import api from "@/services/api";

/**
 * The role the form sends has to be one the backend accepts.
 *
 * `UserRole` is `owner, admin, manager, cashier, barber, accountant`. The form
 * used to send `"employee"` for every job title outside manager/accountant/
 * cashier/owner — which is to say, for a barber, the default — and
 * `create_employee` answers 400 "الدور غير صالح" for any such request. Adding a
 * barber with a login account could not succeed at all.
 *
 * The assertion is on the payload that leaves the app, because the backend is
 * the authority on which roles exist and a frontend constant can drift from it.
 */
const VALID = new Set([
  "owner",
  "admin",
  "manager",
  "cashier",
  "barber",
  "accountant",
]);

const submitWithLogin = async () => {
  api.get = vi.fn().mockResolvedValue({ data: [] });
  api.post = vi.fn().mockResolvedValue({ data: { id: 99 } });
  api.put = vi.fn().mockResolvedValue({ data: { id: 1 } });
};

describe("the role an employee form sends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to a role the backend accepts", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    expect(VALID.has(result.current.formData.role ?? "")).toBe(true);
  });

  it("maps a barber job title to a valid role", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.applyJobTitleDefaults("barber"));
    expect(VALID.has(result.current.formData.role ?? "")).toBe(true);
  });

  it("maps every job title to a role the backend accepts", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    const jobTitles = [
      "owner",
      "manager",
      "accountant",
      "cashier",
      "barber",
      "colorist",
      "esthetician",
      "barber_assistant",
      "receptionist",
      "cleaner",
      "other",
    ];
    for (const title of jobTitles) {
      act(() => result.current.applyJobTitleDefaults(title));
      expect(VALID.has(result.current.formData.role ?? ""), title).toBe(true);
    }
  });

  it("sends a valid role when a login account is created", async () => {
    await submitWithLogin();
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    act(() => {
      result.current.openCreate();
    });

    // A barber with a login — the path that used to 400.
    act(() => {
      result.current.applyJobTitleDefaults("barber");
    });
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        fullName: "أحمد",
        phonePrimary: "01001234567",
        hasLoginAccount: true,
        username: "ahmed",
        password: "Str0ngPass!23",
      }));
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, payload] = (api.post as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u]) => u === "/employees",
    ) as [string, { role: string | null }];
    expect(url).toBe("/employees");
    expect(VALID.has(payload.role ?? "")).toBe(true);
  });

  it("sends null rather than an unrecognised role on an existing record", async () => {
    await submitWithLogin();
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    // A row saved before the fix can still carry the invalid value.
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        fullName: "سارة",
        phonePrimary: "01009876543",
        role: "employee",
        hasLoginAccount: false,
      }));
      result.current.setEditingEmp({ id: 7 });
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, payload] = (api.put as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u]) => u === "/employees/7",
    ) as [string, { role: string | null }];
    expect(url).toBe("/employees/7");
    // Never an invalid non-null role: null is fine (the backend derives it), an
    // unrecognised string is not.
    expect(payload.role === null || VALID.has(payload.role ?? "")).toBe(true);
  });
});
