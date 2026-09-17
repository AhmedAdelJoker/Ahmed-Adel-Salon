import { cn, formatCurrency } from "@/lib/core/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import api from "@/services/api";
import type { EmployeeRecord } from "@/types/employee";
import type { PayrollRecord } from "@/types/payroll";

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; variant: "success" | "danger" | "info" | "secondary" | "warning" }> = { paid: { label: "تم الصرف", variant: "success" }, cancelled: { label: "ملغي", variant: "danger" }, audited: { label: "مدقق", variant: "info" }, calculated: { label: "محسوب", variant: "secondary" } };
  const cur = cfg[status] || { label: status || "غير معروف", variant: "secondary" as const };
  return <Badge variant={cur.variant} className="h-6 px-3 rounded-full font-black text-[10px]">{cur.label}</Badge>;
}

type StaffSnapshotProps = {
  employees: EmployeeRecord[];
  rawRows: PayrollRecord[];
  employeeIdFilter: string | null;
  showAllStaff: boolean;
  setShowAllStaff: React.Dispatch<React.SetStateAction<boolean>>;
  navigate: (to: string) => void;
};

export default function StaffSnapshot({
  employees,
  rawRows,
  employeeIdFilter,
  showAllStaff,
  setShowAllStaff,
  navigate,
}: StaffSnapshotProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary"><Users size={14} /></span> الكادر الحالي</h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted hidden sm:inline">{employees.length} موظف • اضغط للفلترة</span>
          {employees.length > 10 && (
            <Button variant="outline" size="sm" onClick={() => setShowAllStaff((v) => !v)} className="h-8 rounded-xl text-[11px] font-black">
              {showAllStaff ? "عرض أقل" : `عرض الكل (+${employees.length - 10})`}
            </Button>
          )}
        </div>
      </div>
      <div className={cn("flex gap-3 overflow-x-auto pb-2 custom-scrollbar", showAllStaff ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 overflow-visible" : "xl:grid xl:grid-cols-5 xl:overflow-visible")}>
        {(showAllStaff ? employees : employees.slice(0, 10)).map((emp) => {
          const row = rawRows.find((r) => String(r.employee_id || r.employeeId) === String(emp.id));
          const isFiltered = String(employeeIdFilter) === String(emp.id);
          return (
            <Card key={String(emp.id)} onClick={() => navigate(`/owner/payroll?employeeId=${emp.id}&employeeName=${encodeURIComponent(String(emp.full_name || emp.fullName || ""))}`)} className={cn("min-w-[200px] shrink-0 cursor-pointer rounded-2xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md lg:min-w-0", isFiltered && "border-primary/40 bg-primary-soft/40 ring-2 ring-primary/40")}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <img src={emp.profile_image_url ? (typeof emp.profile_image_url === "string" && emp.profile_image_url.startsWith("http") ? emp.profile_image_url : `${api.defaults.baseURL?.replace("/api/v1", "")}${emp.profile_image_url}`) : `https://ui-avatars.com/api/?name=${encodeURIComponent(String(emp.full_name || "M"))}&background=random`} alt={String(emp.full_name || "")} className="h-14 w-14 rounded-2xl object-cover border-2 border-white shadow" />
                  <span className={cn("absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white", emp.status === "active" ? "bg-emerald-500" : "bg-muted")} />
                </div>
                <div className="space-y-0.5 w-full">
                  <div className="text-xs font-black text-main truncate">{String(emp.full_name || emp.fullName || "—")}</div>
                  <div className="truncate text-[10px] font-bold uppercase text-muted">{String(emp.job_title || emp.jobTitle || "موظف")}</div>
                </div>
                <div className="w-full pt-2 border-t border-border/40 flex justify-between text-[11px]">
                  <span className="text-muted font-bold">الأساسي</span><span className="font-black text-main tabular-nums">{formatCurrency(emp.base_salary)}</span>
                </div>
                <div className="w-full flex justify-between text-[11px]">
                  <span className="text-muted font-bold">الصافي</span><span className="font-black text-primary tabular-nums">{formatCurrency(row?.net_salary || 0)}</span>
                </div>
                {row && <StatusBadge status={String(row.status || "")} />}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { StatusBadge };
