import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoneyInput } from "@/features/hr";

/**
 * The behaviours the owner complained about, pinned down:
 *
 * - typing or pasting "-" must not produce a negative, and must not make the
 *   field jump to 0 mid-keystroke (the old `parseFloat(...) || 0` behaviour);
 * - clearing the box must leave it empty until the owner is done, not snap
 *   back to "0" while they are still typing;
 * - the field must be a plain text box — no browser spinner arrows — and the
 *   stored value must stay a number.
 */
describe("MoneyInput", () => {
  it("is a plain text box, never a number spinner", () => {
    render(<MoneyInput value={0} onChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });

  it("cannot receive a minus — '-500' lands as 500", () => {
    const onChange = vi.fn();
    render(<MoneyInput value={0} onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-500" } });
    expect(input.value).toBe("500");
    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it("stays empty while typing — clearing does not snap to 0", () => {
    const onChange = vi.fn();
    render(<MoneyInput value={3000} onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("shows the grouped value only when the field is left", () => {
    render(<MoneyInput value={3000} onChange={() => {}} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("3,000");
    fireEvent.focus(input);
    expect(input.value).toBe("3000");
    fireEvent.blur(input);
    expect(input.value).toBe("3,000");
  });

  it("reports an empty field as 0 on the way out, not as NaN", () => {
    const onChange = vi.fn();
    render(<MoneyInput value={0} onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12." } });
    expect(onChange).toHaveBeenLastCalledWith(12);
    fireEvent.change(input, { target: { value: "." } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("links the error text and marks itself invalid when told to", () => {
    render(
      <MoneyInput
        value={0}
        onChange={() => {}}
        invalid
        describedBy="base-salary-error"
      />,
    );
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("base-salary-error");
  });
});
