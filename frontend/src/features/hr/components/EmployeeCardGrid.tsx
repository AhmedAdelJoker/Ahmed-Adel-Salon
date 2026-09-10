import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUI } from "@/context/UIContext";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import EmptyState from "@/components/shared/EmptyState";
import { cn } from "@/lib/core/utils";
import { EMPLOYMENT_TYPES, JOB_TITLE_BLUEPRINTS } from "@/features/hr/utils/constants";
import { isCustomJobTitleValue } from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

export default function EmployeeCardGrid({
  employees,
  onEdit,
  onDelete,
  onCreate,
}: {
  employees: EmployeeRecord[];
  onEdit: (emp: any) => void;
  onDelete: (emp: any) => void;
  onCreate: () => void;
}) {
  const navigate = useNavigate();
  const { openEmployeeQuickView } = useUI();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      {employees.length === 0 ? (
        <div className="col-span-full">
          <EmptyState
            icon={Users}
            title="لا يوجد كوادر مطابقة"
            description="جرب تعديل كلمات البحث أو أضف موظفاً جديداً للمنظومة."
            action={
              <Button onClick={onCreate} className="rounded-xl bg-accent text-white font-black">
                <Plus size={16} className="ml-2"/> إضافة موظف جديد
              </Button>
            }
          />
        </div>
      ) : employees.map((emp) => {
        const bp =
          JOB_TITLE_BLUEPRINTS[emp.jobTitle ?? ""] ||
          JOB_TITLE_BLUEPRINTS.other;
        const statusActive = emp.status === "active";
        return (
          <motion.div
            key={emp.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft hover:shadow-premium transition-all duration-300"
          >
            {/* Top accent bar */}
            <div className={cn("h-1.5 w-full", bp.accent)} />
            {/* Hover glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative flex flex-1 flex-col p-6 sm:p-7 gap-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-4">
                  <div className="relative shrink-0">
                    <div className="rounded-2xl ring-2 ring-border/50 shadow-lg overflow-hidden bg-soft">
                      <EmployeeAvatar
                        imageUrl={emp.profileImageUrl || emp.profile_image_url}
                        name={emp.fullName}
                        size="xl"
                        className=""
                      />
                    </div>
                    <div className={cn("absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-card shadow-md flex items-center justify-center", statusActive ? "bg-emerald-500" : "bg-rose-500")}>
                      <div className={cn("h-2 w-2 rounded-full bg-white", statusActive && "animate-pulse")} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <h3 className="text-[15px] sm:text-[17px] font-black text-main leading-tight line-clamp-1">
                      {emp.fullName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                          isCustomJobTitleValue(emp.jobTitle)
                            ? "bg-accent/10 text-accent border-accent/20"
                            : bp.badgeClass,
                        )}
                      >
                        {isCustomJobTitleValue(emp.jobTitle) && emp.jobTitle ? emp.jobTitle : bp.title}
                      </Badge>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black border", statusActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                        {statusActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {statusActive ? "نشط" : "معلّق"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                      <span className="inline-flex items-center gap-1"><Calendar size={11} /> {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString("ar-EG") : "—"}</span>
                      {emp.employmentType && <span className="hidden sm:inline">• {EMPLOYMENT_TYPES.find(t=>t.value===emp.employmentType)?.label || emp.employmentType}</span>}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-soft text-muted hover:bg-card hover:text-accent border border-border/50 shrink-0">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border shadow-premium bg-card">
                    <DropdownMenuItem onClick={() => onEdit(emp)} className="rounded-xl font-bold py-3">
                      <Pencil size={16} className="ml-3 text-accent" /> تعديل الملف
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/owner/payroll?employeeId=${emp.id}`)} className="rounded-xl font-bold py-3">
                      <DollarSign size={16} className="ml-3 text-emerald-600" /> كشف الراتب
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/attendance?employeeId=${emp.id}`)} className="rounded-xl font-bold py-3">
                      <Clock size={16} className="ml-3 text-sky-600" /> سجل الحضور
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEmployeeQuickView(emp.id as string | number)} className="rounded-xl font-bold py-3">
                      <Eye size={16} className="ml-3 text-indigo-600" /> عرض سريع
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-2" />
                    <DropdownMenuItem onClick={() => onDelete(emp)} className="rounded-xl font-bold py-3 text-rose-600">
                      <XCircle size={16} className="ml-3" /> {emp.status === "active" ? "تعطيل الملف" : "تفعيل الملف"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Decorative separator */}
              <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="group/stat rounded-2xl bg-soft border border-border/60 p-3 sm:p-4 hover:border-accent/20 hover:bg-card transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><Wallet size={14} /></div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-widest">الراتب الأساسي</span>
                  </div>
                  <div className="text-[15px] font-black text-main">
                    {Number(emp.baseSalary).toLocaleString("ar-EG")} <span className="text-[10px] font-bold text-muted">ج.م</span>
                  </div>
                </div>
                <div className="group/stat rounded-2xl bg-soft border border-border/60 p-3 sm:p-4 hover:border-accent/20 hover:bg-card transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center"><TrendingUp size={14} /></div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-widest">العمولة</span>
                  </div>
                  <div className="text-[15px] font-black text-main">
                    {emp.commissionRate} <span className="text-[10px] font-bold text-muted">%</span>
                  </div>
                </div>
              </div>

              {/* Contact & Actions */}
              <div className="mt-auto space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-accent/[0.06] border border-accent/10 p-3">
                  <div className="h-9 w-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm shrink-0">
                    <Phone size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest">الجوال الأساسي</div>
                    <div className="text-[13px] font-black text-main truncate" dir="ltr">{emp.phonePrimary}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(emp)} className="h-9 w-9 rounded-xl bg-card border border-border text-muted hover:text-accent hover:border-accent/20 shrink-0">
                    <Pencil size={14} />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => openEmployeeQuickView(emp.id as string | number)} className="flex-1 h-10 rounded-xl bg-soft hover:bg-accent hover:text-white text-main font-black text-[11px] border border-border transition-all">
                    <Eye size={14} className="ml-2" /> معاينة
                  </Button>
                  <Button onClick={() => onEdit(emp)} className="flex-1 h-10 rounded-xl bg-accent text-white font-black text-[11px] shadow-lg shadow-accent/20 hover:bg-accent/90">
                    <Pencil size={14} className="ml-2" /> تعديل
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
