import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  children: ReactNode;
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-muted sm:text-[10px]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default FormField;
