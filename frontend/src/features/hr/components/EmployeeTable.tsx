import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { DollarSign, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { getJobTitleLabel } from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

export default function EmployeeTable({
  employees,
  onEdit,
  onDelete,
}: {
  employees: EmployeeRecord[];
  onEdit: (emp: any) => void;
  onDelete: (emp: any) => void;
}) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <PremiumCard noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-soft/50">
              <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                الموظف
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                المسمى
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                الجوال
              </th>
              <th className="px-8 py-6 text-[10px] font-black text-muted uppercase tracking-widest">
                الراتب
              </th>
              <th className="px-8 py-6 text-center text-[10px] font-black text-muted uppercase tracking-widest">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {employees.map((emp) => (
              <tr
                key={emp.id}
                className="group transition-colors hover:bg-soft/30"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <EmployeeAvatar
                      imageUrl={
                        emp.profileImageUrl || emp.profile_image_url
                      }
                      name={emp.fullName}
                      size="sm"
                    />
                    <div className="font-black text-main">
                      {emp.fullName}
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <Badge
                    variant="outline"
                    className="rounded-full px-3 py-1 text-[9px] font-black bg-card"
                  >
                    {getJobTitleLabel(emp.jobTitle)}
                  </Badge>
                </td>
                <td className="px-8 py-5 font-bold text-muted" dir="ltr">
                  {emp.phonePrimary}
                </td>
                <td className="px-8 py-5 font-black text-main">
                  {Number(emp.baseSalary ?? 0).toLocaleString("ar-EG")} ج.م
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(emp)}
                      className="h-10 w-10 rounded-xl text-accent hover:bg-accent/10"
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        navigate(`/owner/payroll?employeeId=${emp.id}`)
                      }
                      className="h-10 w-10 rounded-xl text-emerald-600 hover:bg-emerald-50"
                    >
                      <DollarSign size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(emp)}
                      className="h-10 w-10 rounded-xl text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </PremiumCard>
    </motion.div>
  );
}
