import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export interface StatusRowProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  enabled: unknown;
  note?: React.ReactNode;
}

export default function StatusRow({ icon: Icon, title, enabled, note }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-soft p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${enabled ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        >
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-black text-main">
            {title}
          </p>
          {note ? (
            <p className="text-xs font-bold text-muted">
              {note}
            </p>
          ) : null}
        </div>
      </div>
      {enabled ? (
        <CheckCircle2 className="text-success" />
      ) : (
        <XCircle className="text-danger" />
      )}
    </div>
  );
}
