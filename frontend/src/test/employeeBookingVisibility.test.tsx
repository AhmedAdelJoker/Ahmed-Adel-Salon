import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor, render, screen } from "@testing-library/react";
import api from "@/services/api";
import { useEmployeeForm } from "@/features/hr/hooks/useEmployeeForm";
import { WorkTab, defaultForm } from "@/features/hr";

/**
 * Booking visibility is a classification, not a free toggle.
 *
 * The server drops `show_in_booking` for anyone who is not a service provider
 * (see `test_employee_booking_flag.py`); the form has to agree with it — the
 * switch is only offered where it means something, and the payload never
 * claims a cashier is visible online.
 */
const mockSubmitApi = () => {
  api.get = vi.fn().mockResolvedValue({ data: [] });
  api.post = vi.fn().mockResolvedValue({ data: { id: 99 } });
  api.put = vi.fn().mockResolvedValue({ data: { id: 1 } });
};

const submittedPayload = (method: "post" | "put", url: string) => {
  const calls = (api[method] as ReturnType<typeof vi.fn>).mock.calls;
  const match = calls.find(([u]) => u === url);
  return match?.[1] as Record<string, unknown>;
};

const submitAs = async (overrides: Record<string, unknown>) => {
  const { result } = renderHook(() => useEmployeeForm(async () => {}));
  act(() => {
    result.current.openCreate();
  });
  act(() => {
    result.current.setFormData((prev) => ({
      ...prev,
      fullName: "أحمد محمد علي",
      phonePrimary: "01001234567",
      hasLoginAccount: false,
      ...overrides,
    }));
  });
  await act(async () => {
    await result.current.handleSubmit();
  });
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  return submittedPayload("post", "/employees");
};

describe("booking defaults when a job title is picked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("turns booking on for every service provider", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    for (const title of ["barber", "colorist", "esthetician"]) {
      act(() => result.current.applyJobTitleDefaults(title));
      expect(result.current.formData.showInBooking, title).toBe(true);
      expect(result.current.formData.showInPos, title).toBe(true);
    }
  });

  it("never turns booking on for admin, support or assistant roles", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    for (const title of [
      "accountant",
      "manager",
      "cashier",
      "barber_assistant",
      "receptionist",
      "cleaner",
      "owner",
      "other",
    ]) {
      act(() => result.current.applyJobTitleDefaults(title));
      expect(result.current.formData.showInBooking, title).toBe(false);
    }
  });

  it("keeps cashiers visible at the till even without online booking", () => {
    const { result } = renderHook(() => useEmployeeForm(async () => {}));
    act(() => result.current.applyJobTitleDefaults("cashier"));
    expect(result.current.formData.showInPos).toBe(true);
    expect(result.current.formData.showInBooking).toBe(false);
  });
});

describe("the payload sent to the server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitApi();
  });

  it("drops showInBooking for an accountant even when the form state says on", async () => {
    const payload = await submitAs({
      jobTitle: "accountant",
      role: "accountant",
      showInBooking: true,
    });
    expect(payload.showInBooking).toBe(false);
  });

  it("keeps showInBooking for a colorist", async () => {
    const payload = await submitAs({
      jobTitle: "colorist",
      role: "barber",
      showInBooking: true,
    });
    expect(payload.showInBooking).toBe(true);
  });
});

const renderWorkTab = (jobTitle: string) =>
  render(
    <WorkTab
      formData={{ ...defaultForm, jobTitle } as never}
      setFormData={() => {}}
      customJobTitle={false}
      setCustomJobTitle={() => {}}
      applyJobTitleDefaults={() => {}}
      hiddenSteps={[]}
    />,
  );

describe("the booking switch in the Work step", () => {
  it("is offered to a barber", () => {
    renderWorkTab("barber");
    expect(screen.getByText("الظهور في الحجز الأونلاين")).toBeTruthy();
  });

  it("is offered to a colorist", () => {
    renderWorkTab("colorist");
    expect(screen.getByText("الظهور في الحجز الأونلاين")).toBeTruthy();
  });

  it("is replaced by an explanation for an accountant", () => {
    renderWorkTab("accountant");
    expect(screen.queryByText("الظهور في الحجز الأونلاين")).toBeNull();
    expect(screen.getByText(/مقدّمي الخدمة فقط/)).toBeTruthy();
  });
});
