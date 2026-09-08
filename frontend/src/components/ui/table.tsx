import * as React from "react";
import { cn } from "@/lib/core/utils";

function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="premium-table custom-scrollbar relative w-full max-w-full overflow-auto rounded-[1.1rem] border border-border bg-white/90 shadow-sm dark:border-white/10 dark:bg-slate-900/72 sm:rounded-[1.4rem]">
      <table
        className={cn(
          "w-full min-w-[720px] caption-bottom table-auto text-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("premium-table__head [&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "border-t border-border bg-soft font-black text-gray-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-50",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-[background-color,transform] duration-300 hover:bg-slate-50/80 data-[state=selected]:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 dark:data-[state=selected]:bg-white/5",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-12 px-3 text-right align-middle text-[11px] font-black uppercase tracking-normal text-gray-500 sm:px-4 [&:has([role=checkbox])]:pr-0 dark:text-gray-400",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "p-3 align-middle font-bold leading-relaxed text-gray-800 sm:p-4 [&:has([role=checkbox])]:pr-0 dark:text-gray-100",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn(
        "mt-4 text-sm font-bold text-gray-500 dark:text-gray-400",
        className,
      )}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
