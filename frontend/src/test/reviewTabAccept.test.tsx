import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewTab } from "@/features/hr";

/**
 * The approval action has to be on the review step.
 *
 * It used to live only in the desktop sidebar, disabled until the review step
 * was reached — so on a phone, where that sidebar is not rendered, there was no
 * button to finish the form at all.
 */
describe("the review step's approval button", () => {
  const blueprint = { title: "Master Barber" };
  const baseForm = {
    fullName: "أحمد محمود",
    jobTitle: "barber",
    phonePrimary: "01000000001",
    baseSalary: 3000,
    commissionRate: 15,
    paymentMethod: "cash",
    hasLoginAccount: false,
    role: "barber",
    username: "",
  };

  it("offers قبول for a new employee", () => {
    render(
      <ReviewTab
        formData={baseForm}
        blueprint={blueprint}
        onSubmit={() => {}}
        isActionLoading={false}
        isEditing={false}
      />,
    );
    expect(screen.getByRole("button", { name: /قبول الموظف الجديد/ })).toBeTruthy();
  });

  it("offers قبول for an edit", () => {
    render(
      <ReviewTab
        formData={baseForm}
        blueprint={blueprint}
        onSubmit={() => {}}
        isActionLoading={false}
        isEditing
      />,
    );
    expect(screen.getByRole("button", { name: /قبول التعديلات/ })).toBeTruthy();
  });

  it("submits when pressed", () => {
    const onSubmit = vi.fn();
    render(
      <ReviewTab
        formData={baseForm}
        blueprint={blueprint}
        onSubmit={onSubmit}
        isActionLoading={false}
        isEditing={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /قبول الموظف الجديد/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("says it is working while saving", () => {
    render(
      <ReviewTab
        formData={baseForm}
        blueprint={blueprint}
        onSubmit={() => {}}
        isActionLoading
        isEditing={false}
      />,
    );
    expect(screen.getByRole("button", { name: /جاري الاعتماد/ })).toBeTruthy();
  });

  it("still warns when a login-needing role has no account", () => {
    render(
      <ReviewTab
        formData={{ ...baseForm, jobTitle: "cashier", hasLoginAccount: false }}
        blueprint={blueprint}
        onSubmit={() => {}}
        isActionLoading={false}
        isEditing={false}
      />,
    );
    expect(screen.getByText(/لا يمكن لهذا الدور العمل بدون حساب نظام/)).toBeTruthy();
  });
});
