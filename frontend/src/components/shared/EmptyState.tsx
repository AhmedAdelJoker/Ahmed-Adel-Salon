/**
 * The single empty state in the app.
 *
 * There used to be six of these, each with a different prop vocabulary
 * (`message` / `description` / `text` / `desc`), a different icon contract and a
 * different size, so the same "nothing here" moment looked different depending
 * on which page you were on. This is the one replacement.
 *
 *   <EmptyState
 *     variant="table"
 *     icon={Receipt}
 *     title="لا توجد فواتير"
 *     message="لم يتم إصدار أي فاتورة في هذه الفترة."
 *     action={<Button onClick={exportAll}>تصدير</Button>}
 *   />
 *
 * `variant` picks the size, not the meaning. Keep the number of variants small:
 * each one is a real, distinct footprint in the layouts that exist today.
 */
import React, { type ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/core/utils";

export type EmptyStateVariant =
  /** Whole page. */
  | "page"
  /** A card-sized region within a page. */
  | "section"
  /** Inside a table body, replacing the rows. */
  | "table"
  /** Small, inside a tab or a side panel. */
  | "inline"
  /** Inside a single column of a board. */
  | "board";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  /**
   * A Lucide icon component, or any node. A component is sized and coloured
   * for you; a node is rendered as-is.
   */
  icon?: LucideIcon | ReactNode;
  title?: string;
  /** One sentence saying what would make this non-empty. */
  message?: string;
  /** Primary call to action, usually a Button. */
  action?: ReactNode;
  className?: string;
}

const SIZES: Record<
  EmptyStateVariant,
  { wrap: string; iconWrap: string; icon: number; title: string; message: string }
> = {
  page: {
    wrap: "py-12 px-6 sm:py-16 sm:px-10",
    iconWrap: "h-14 w-14 sm:h-16 sm:w-16 rounded-2xl",
    icon: 28,
    title: "text-lg sm:text-xl",
    message: "text-xs sm:text-sm",
  },
  section: {
    wrap: "py-8 px-5",
    iconWrap: "h-12 w-12 rounded-2xl",
    icon: 22,
    title: "text-base",
    message: "text-xs",
  },
  table: {
    wrap: "py-14 px-6",
    iconWrap: "h-14 w-14 rounded-full",
    icon: 26,
    title: "text-base",
    message: "text-xs",
  },
  inline: {
    wrap: "py-8 px-4",
    iconWrap: "h-11 w-11 rounded-2xl",
    icon: 20,
    title: "text-sm",
    message: "text-[11px]",
  },
  board: {
    wrap: "h-32 sm:h-40 p-4 sm:p-6 border-2 border-dashed border-border/40 rounded-2xl sm:rounded-3xl bg-soft/30",
    iconWrap: "w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl",
    icon: 20,
    title: "text-xs sm:text-sm",
    message: "text-[10px] sm:text-xs",
  },
};

export function EmptyState({
  variant = "section",
  icon,
  title = "لا توجد بيانات",
  message,
  action,
  className,
}: EmptyStateProps) {
  const size = SIZES[variant];
  // Is this a React *element* (render it as-is) or a *component type* (use it
  // as <Icon/>)?
  //
  // The test is `React.isValidElement`, not `typeof icon === "object"`. Every
  // lucide icon is created with `React.forwardRef`, so it is an object --
  // literally `{$$typeof, render}` -- which the old typeof check classified as
  // an element and passed straight into JSX. React then received a component
  // where it expected a rendered child:
  //
  //     Objects are not valid as a React child
  //     (found: object with keys {$$typeof, render})
  //
  // which crashed the whole subtree, not just the empty state: 76 call sites
  // pass a lucide icon, so every empty board column, table and panel took its
  // page down with it. `React.forwardRef` returning an object rather than a
  // function is the whole reason `typeof icon === "function"` on the next line
  // never fired either -- it excluded every real icon as well.
  const element = React.isValidElement(icon) ? icon : null;
  const Icon = !element && typeof icon === "function" ? icon : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "card-surface flex flex-col items-center justify-center gap-4 text-center",
        variant === "board" ? "opacity-60" : "",
        size.wrap,
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center bg-soft text-muted",
          size.iconWrap,
        )}
      >
        {element ? (
          element
        ) : Icon ? (
          <Icon size={size.icon} strokeWidth={1.5} />
        ) : (
          <Inbox size={size.icon} strokeWidth={1.5} />
        )}
      </div>

      <div className="max-w-md space-y-1">
        <h3 className={cn("font-black text-main", size.title)}>{title}</h3>
        {message ? (
          <p className={cn("font-bold text-muted leading-relaxed", size.message)}>
            {message}
          </p>
        ) : null}
      </div>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
