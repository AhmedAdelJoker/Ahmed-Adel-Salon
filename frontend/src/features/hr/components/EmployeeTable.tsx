import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/core/utils";
import { Archive, CalendarOff, DollarSign, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { EmployeePhoto } from "@/components/shared/EmployeePhoto";
import { getJobTitleLabel } from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

/**
 * Status chip for the team list: active (نشط), on vacation (في إجازة) — kept
 * in the list with a warning tone, not an error tone — and a muted fallback.
 */
const statusMeta = (status?: string) => {
  if (status === "active") {
    return {
      label: "نشط",
      chip: "border-success/20 bg-success-soft text-success",
      dot: "bg-success",
    };
  }
  if (status === "suspended") {
    return {
      label: "في إجازة",
      chip: "border-warning/20 bg-warning-soft text-warning",
      dot: "bg-warning",
    };
  }
  return {
    label: "أرشيف",
    chip: "border-border bg-soft text-muted",
    dot: "bg-muted",
  };
};

export default function EmployeeTable({
  employees,
  onEdit,
  onDelete,
  onArchive,
}: {
  employees: EmployeeRecord[];
  onEdit: (emp: any) => void;
  onDelete: (emp: any) => void;
  onArchive: (emp: any) => void;
}) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <PremiumCard noPadding className="overflow-hidden">
        <div className="hidden lg:block overflow-x-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-soft/50 text-[10px] font-black uppercase tracking-widest text-muted">
                <TableHead className="px-4 py-4 sm:px-5">الموظف</TableHead>
                <TableHead className="px-4 py-4 sm:px-5">المسمى</TableHead>
                <TableHead className="px-4 py-4 sm:px-5">الجوال</TableHead>
                <TableHead className="px-4 py-4 sm:px-5">الحالة</TableHead>
                <TableHead className="px-4 py-4 sm:px-5">الراتب</TableHead>
                <TableHead className="px-4 py-4 sm:px-5 text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/40">
              {employees.map((emp) => {
                const status = statusMeta(emp.status);
                return (
                <TableRow
                  key={emp.id}
                  className="hover:bg-soft/30 transition-colors"
                >
                  <TableCell className="px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <EmployeePhoto
                    imageUrl={emp.profileImageUrl || emp.profile_image_url}
                    name={emp.fullName}
                    role={getJobTitleLabel(emp.jobTitle)}
                    size="sm"
                    shape="circle"
                  />
                  <span className="font-black text-main truncate">{emp.fullName}</span>
                </div>
                  </TableCell>
                  <TableCell className="px-4 py-4 sm:px-5">
                    <Badge
                      variant="outline"
                      className="rounded-full bg-soft font-bold text-[10px]"
                    >
                      {getJobTitleLabel(emp.jobTitle)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-4 sm:px-5 font-bold text-muted" dir="ltr">
                    {emp.phonePrimary}
                  </TableCell>
                  <TableCell className="px-4 py-4 sm:px-5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${status.chip}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                      />
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-4 sm:px-5 font-black text-main">
                    {formatCurrency(emp.baseSalary ?? 0)}
                  </TableCell>
                  <TableCell className="px-4 py-4 sm:px-5">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(emp)}
                        className="h-9 w-9 rounded-xl"
                        title="تعديل"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          navigate(`/owner/payroll?employeeId=${emp.id}`)
                        }
                        className="h-9 w-9 rounded-xl text-success hover:bg-success-soft"
                        title="كشف الراتب"
                      >
                        <DollarSign size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(emp)}
                        className={
                          emp.status === "active"
                            ? "h-9 w-9 rounded-xl text-warning hover:bg-warning-soft"
                            : "h-9 w-9 rounded-xl text-success hover:bg-success-soft"
                        }
                        title={
                          emp.status === "active" ? "تسجيل إجازة" : "إرجاع للعمل"
                        }
                      >
                        {emp.status === "active" ? (
                          <CalendarOff size={16} />
                        ) : (
                          <RotateCcw size={16} />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onArchive(emp)}
                        className="h-9 w-9 rounded-xl text-danger hover:bg-danger-soft"
                        title="أرشفة (ترك العمل)"
                      >
                        <Archive size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {/* Mobile cards — mirrors table data */}
        <div className="grid grid-cols-1 gap-3 p-4 lg:hidden">
          {employees.map((emp) => {
            const status = statusMeta(emp.status);
            return (
            <div key={emp.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <EmployeePhoto
                    imageUrl={emp.profileImageUrl || emp.profile_image_url}
                    name={emp.fullName}
                    size="sm"
                    shape="circle"
                    hintMissing={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black truncate">{emp.fullName}</div>
                  <Badge variant="outline" className="mt-1 rounded-full bg-soft text-[10px]">
                    {getJobTitleLabel(emp.jobTitle)}
                  </Badge>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${status.chip}`}
                >
                  {status.label}
                </span>
                <span className="text-[10px] font-bold text-muted" dir="ltr">
                  {emp.phonePrimary || "—"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-soft border border-border p-3">
                  <div className="text-[9px] font-black text-muted uppercase">الجوال</div>
                  <div className="font-bold text-main mt-1" dir="ltr">{emp.phonePrimary || "—"}</div>
                </div>
                <div className="rounded-xl bg-soft border border-border p-3">
                  <div className="text-[9px] font-black text-muted uppercase">الراتب</div>
                  <div className="font-black text-main mt-1">{formatCurrency(emp.baseSalary ?? 0)}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl font-black" onClick={() => onEdit(emp)}>
                  <Pencil size={14} className="ms-1" /> تعديل
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    emp.status === "active"
                      ? "rounded-xl text-warning"
                      : "rounded-xl text-success"
                  }
                  onClick={() => onDelete(emp)}
                  title={
                    emp.status === "active" ? "تسجيل إجازة" : "إرجاع للعمل"
                  }
                >
                  {emp.status === "active" ? (
                    <CalendarOff size={14} />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl text-danger"
                  onClick={() => onArchive(emp)}
                  title="أرشفة (ترك العمل)"
                >
                  <Archive size={14} />
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      </PremiumCard>
    </motion.div>
  );
}