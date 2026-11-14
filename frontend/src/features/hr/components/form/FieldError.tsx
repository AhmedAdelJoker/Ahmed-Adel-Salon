/**
 * One error line under a field.
 *
 * The wizard used to hand-roll this markup in each tab — and drifted: some
 * errors used the raw `text-red-500` instead of the theme's `text-danger`, so
 * the same mistake looked like two different severities. One component makes
 * every error the same colour, the same weight and the same `role="alert"`.
 */
import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export default function FieldError({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-1.5 text-xs font-bold text-danger"
    >
      <AlertCircle size={13} className="shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
