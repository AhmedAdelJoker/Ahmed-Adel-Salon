/**
 * A money/percent field that does not fight the person typing in it.
 *
 * The old fields were `<input type="number">` bound through
 * `parseFloat(...) || 0`: clearing the box snapped it back to "0" mid-typing,
 * a typed minus was swallowed and the field jumped to "0", and the browser
 * drew spinner arrows over the value. Here:
 *
 * - the text lives in local state while the field is focused, so empty stays
 *   empty until the owner is done and the field is left;
 * - only digits and one decimal point survive (Arabic numerals are read as
 *   English — see `normalizeMoneyTyping`), so a minus can never be entered;
 * - a grouped value ("5,000") is shown once the field is left, never while
 *   the caret is inside it, so typing is never reformatted under the cursor;
 * - the parent still receives a plain number on every change.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { FIELD_INPUT_CLASS } from "@/features/hr";
import { normalizeMoneyTyping } from "@/features/hr/utils/digits";

/** The resting display of a stored amount: 5000 becomes "5,000". */
function grouped(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : "0";
}

/**
 * The record type is loose (`string | number | undefined`), and a loaded
 * record can carry either — coerce once here so every field behaves the same.
 */
function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export default function MoneyInput({
  value,
  onChange,
  suffix,
  invalid,
  describedBy,
}: {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  /** Unit shown inside the field, e.g. the currency label or "%". */
  suffix?: ReactNode;
  invalid?: boolean;
  describedBy?: string;
}) {
  // null = not editing: render the grouped value straight from the prop, so
  // an external change (loading an employee) always wins outside focus.
  const [typed, setTyped] = useState<string | null>(null);
  const amount = toNumber(value);

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        dir="ltr"
        className={`${FIELD_INPUT_CLASS}${suffix ? " pe-12" : ""}`}
        value={typed ?? grouped(amount)}
        onFocus={() => setTyped(String(amount))}
        onChange={(e) => {
          const cleaned = normalizeMoneyTyping(e.target.value);
          setTyped(cleaned);
          const parsed = parseFloat(cleaned);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        onBlur={() => setTyped(null)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      />
      {suffix ? (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
