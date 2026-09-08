import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { MoreVertical } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string }> = {
  in: { label: "حضور", color: "bg-emerald-500/10 text-emerald-600" },
  out: { label: "انصراف", color: "bg-red-500/10 text-red-600" },
  break: { label: "استراحة", color: "bg-orange-500/10 text-orange-600" },
  break_end: { label: "عودة", color: "bg-blue-500/10 text-blue-600" },
};

interface ArchiveRowProps {
   
  rec: any;
   
  employees?: any[];
}

const ArchiveRow = ({ rec, employees }: ArchiveRowProps) => {
   
  const employee = employees?.find((e: any) => String(e.id) === String(rec.employee_id));
  const empName = rec.employee_name || employee?.full_name || "موظف غير معروف";
  const empImage = employee?.profile_image_url;
  const status = rec.status || "in";
  const statusInfo = statusConfig[status] || statusConfig.in;

  const formatDateTime = (timestamp: string | number | Date | null | undefined) => {
    if (!timestamp) return "--:--";
    return new Date(timestamp).toLocaleString("ar-EG", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <tr className="transition-colors hover:bg-primary-soft/20 group">
      <td className="px-3 py-3 sm:px-4 sm:py-4">
        <EmployeeAvatar
          imageUrl={empImage}
          name={empName}
          role={undefined}
          size="sm"
          showInfo={true}
          className={undefined}
        />
      </td>
      <td className="px-3 py-3 sm:px-4 sm:py-4">
        <Badge
          className={cn(
            "rounded-md px-2.5 py-1 text-[8px] font-black uppercase sm:px-3 sm:py-1 sm:text-[9px]",
            statusInfo.color,
          )}
        >
          {statusInfo.label}
        </Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-center text-[10px] font-bold tabular-nums text-muted sm:px-4 sm:py-4 sm:text-xs">
        {formatDateTime(rec.created_at)}
      </td>
      <td className="px-3 py-3 text-center sm:px-4 sm:py-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted group-hover:text-primary sm:h-8 sm:w-8"
          aria-label="خيارات"
        >
          <MoreVertical size={14} />
        </Button>
      </td>
    </tr>
  );
};

export default ArchiveRow;
