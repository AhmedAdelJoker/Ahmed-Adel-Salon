import React from "react";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";

interface EmployeeCardHeaderProps {
  empName: string;
  empImage?: string;
  status: string;
  statusInfo: {
    label: string;
    color: string;
    textColor: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  };
  aiInfo: {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  };
  aiLabel: string;
}

export function EmployeeCardHeader({
  empName,
  empImage,
  status,
  statusInfo,
  aiInfo,
  aiLabel,
}: EmployeeCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <EmployeeAvatar
          imageUrl={empImage}
          name={empName}
          size="lg"
          status={status === "in" ? "active" : "inactive"}
        />
        <div className="min-w-0">
          <h3
            className="truncate text-base font-black text-main sm:text-lg"
            title={empName}
          >
            {empName}
          </h3>
          <Badge
            className={cn(
              "mt-0.5 rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider sm:text-[9px]",
              aiInfo.bgColor,
              aiInfo.color,
            )}
          >
            {aiInfo.icon && <aiInfo.icon size={9} className="ml-0.5" />}
            {aiLabel}
          </Badge>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div
          className={cn(
            "h-2 w-2 rounded-full animate-pulse",
            statusInfo.color,
          )}
        />
        <span className="text-[10px] font-bold text-muted sm:text-xs">
          {statusInfo.label}
        </span>
      </div>
    </div>
  );
}

export default EmployeeCardHeader;
