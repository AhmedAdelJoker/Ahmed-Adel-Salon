import * as React from "react";
import { cn } from "../../lib/utils";

function Table({ className, ...props }) {
return (
    <div className="premium-table custom-scrollbar relative w-full overflow-auto rounded-[1.7rem] border border-border bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead className={cn("premium-table__head [&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

function TableFooter({ className, ...props }) {
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

function TableRow({ className, ...props }) {
  return (
    <tr
      className={cn(
        "border-b border-border transition-[background-color,transform] duration-300 hover:bg-purple-50/60 data-[state=selected]:bg-purple-50 dark:border-white/10 dark:hover:bg-cyan-400/10 dark:data-[state=selected]:bg-cyan-400/10",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        "h-13 px-4 text-right align-middle text-[11px] font-black uppercase tracking-[0.22em] text-gray-500 [&:has([role=checkbox])]:pr-0 dark:text-gray-400",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return (
    <td
      className={cn(
        "p-4 align-middle font-bold text-gray-800 [&:has([role=checkbox])]:pr-0 dark:text-gray-100",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }) {
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


