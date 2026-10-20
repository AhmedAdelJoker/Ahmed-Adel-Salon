import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEmployeeForm } from "@/features/hr/hooks/useEmployeeForm";
import api from "@/services/api";

/**
 * Two barbers sharing a phone number is the failure that actually costs money:
 * attendance and commission get posted against whichever row the app happens
 * to match first, so the honest reading is "who does this number belong to".
 *
 * The form checks before it writes, because a server-side rejection after the
 * save leaves the owner looking at a form that refused but changed nothing.
 */
describe("submitting an employee with a phone already on file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post = vi.fn().mockResolvedValue({ data: { id: 99 } });
    api.put = vi.fn().mockResolvedValue({ data: { id: 1 } });
  });

  const fill = (result: { current: ReturnType<typeof useEmployeeForm> }, phone: string) => {
    act(() => {
      result.current.setFormData((prev) => ({
        ...prev,
        fullName: "أحمد",
        phonePrimary: phone,
      }));
    });
  };

  it("refuses to save and names the employee who already holds the number", async () => {
    api.get = vi.fn().mockResolvedValue({
      data: [{ id: 4, fullName: "سارة", phonePrimary: "01001234567" }],
    });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "01001234567");

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("matches a number that is typed with different separators", async () => {
    api.get = vi.fn().mockResolvedValue({
      data: [{ id: 4, fullName: "سارة", phonePrimary: "01001234567" }],
    });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "0100 123 4567");

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.post).not.toHaveBeenCalled();
  });

  it("looks the number up by digits, not by the raw typed string", async () => {
    api.get = vi.fn().mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "0100 123 4567");

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.get).toHaveBeenCalledWith(
      "/employees",
      expect.objectContaining({ params: expect.objectContaining({ q: "01001234567" }) }),
    );
    await waitFor(() => expect(api.post).toHaveBeenCalled());
  });

  it("does not collide with the employee being edited", async () => {
    // The roster search finds this row itself; saving must still work.
    api.get = vi.fn().mockResolvedValue({
      data: [{ id: 7, fullName: "أحمد", phonePrimary: "01001234567" }],
    });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "01001234567");
    act(() => {
      result.current.setEditingEmp({ id: 7 });
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => expect(api.put).toHaveBeenCalled());
  });

  it("still catches a clash while editing someone else", async () => {
    api.get = vi.fn().mockResolvedValue({
      data: [{ id: 4, fullName: "سارة", phonePrimary: "01001234567" }],
    });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "01001234567");
    act(() => {
      result.current.setEditingEmp({ id: 7 });
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.put).not.toHaveBeenCalled();
  });

  it("blocks an obviously malformed number before spending a request on it", async () => {
    api.get = vi.fn().mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "0101234");

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("does not block a save when the lookup itself fails", async () => {
    // A failed read must not make a valid employee unsaveable.
    api.get = vi.fn().mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useEmployeeForm(async () => {}));

    fill(result, "01001234567");

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => expect(api.post).toHaveBeenCalled());
  });
});