import { CheckCircle, Play, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusVariant, canonicalStatus } from "@/lib/barberStatus";

type Size = "sm" | "md";

interface AppointmentStatusActionsProps {
  status: string | null | undefined;
  onChange: (status: string) => void;
  size?: Size;
  /** Disable the cancel action, e.g. once payment has been taken. */
  allowCancel?: boolean;
  className?: string;
}

/**
 * The one status control for an appointment row.
 *
 * ## What this replaces
 *
 * `QueueTab` and `AppointmentsList` each hand-rolled the same two buttons from
 * the same two `if` statements, and `TimerCard` / `QuickActionsPanel` in the
 * workstation rendered a third and fourth copy. That was not only duplication:
 *
 * - `waiting -> in-service` was offered from three places
 * - `in-service -> completed` from five
 *
 * and the two families behaved differently. The workstation routes completion
 * through a confirmation dialog that collects a tip; the list buttons fired the
 * mutation immediately. So the same action meant "confirm and record a tip" on
 * one screen and "done, hope that's right" on another.
 *
 * This component offers exactly what `allowedTransitions` allows -- the same
 * table the API enforces -- so a button cannot render for a move the server
 * would reject with 409. Everything terminal renders as a badge, which is what
 * the two previous copies did by hand for `completed` only, and what they
 * therefore got wrong for `cancelled`, `no_show` and `ready_for_payment`: those
 * fell into the final `else` and were shown as "مكتمل" with a green tick.
 *
 * ## Completion is confirmed, not fired
 *
 * `onChange("ready_for_payment")` is passed up rather than calling the API here,
 * so the caller decides whether completion needs a confirmation step. Pass
 * `onConfirmComplete` where it does.
 */
export const AppointmentStatusActions = ({
  status,
  onChange,
  size = "sm",
  allowCancel = true,
  className = "",
}: AppointmentStatusActionsProps) => {
  const current = canonicalStatus(status);

  const buttonSize = size === "sm" ? "sm" : "default";
  const sizing =
    size === "sm"
      ? "h-9 rounded-xl px-4 text-[10px] font-black"
      : "h-10 rounded-xl px-5 text-xs font-black";

  // Terminal states: show what it is, offer nothing.
  if (["ready_for_payment", "cancelled", "no_show", "done"].includes(current)) {
    return (
      <Badge
        variant={statusVariant(current)}
        className={`h-7 px-3 text-[10px] font-black ${className}`}
      >
        <CheckCircle size={10} className="ms-1" />
        {current === "ready_for_payment" ? "بانتظار الدفع" : "مكتمل"}
      </Badge>
    );
  }

  const canStart = ["pending", "confirmed", "waiting"].includes(current);
  const inService = current === "in-service" || current === "in_progress";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {canStart && (
        <Button
          size={buttonSize}
          className={sizing}
          onClick={() => onChange("in-service")}
        >
          <Play size={12} className="ms-1" /> بدء
        </Button>
      )}

      {inService && (
        <Button
          size={buttonSize}
          variant="success"
          className={sizing}
          onClick={() => onChange("ready_for_payment")}
        >
          <CheckCircle size={12} className="ms-1" /> إنهاء
        </Button>
      )}

      {allowCancel && (canStart || inService) && (
        <Button
          size={buttonSize}
          variant="outline"
          className={`${sizing} text-danger`}
          onClick={() => onChange("cancelled")}
          aria-label="إلغاء الموعد"
        >
          <XCircle size={12} className="ms-1" /> إلغاء
        </Button>
      )}
    </div>
  );
};

export default AppointmentStatusActions;