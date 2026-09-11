import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Search,
  UserX,
  History,
  RotateCcw,
  Phone,
  Calendar,
  Briefcase,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useEmployeesArchive, useInvalidateEmployees } from "@/hooks/useApi";
import { normalizeEmployeeRecord } from "@/features/hr/utils/helpers";
import api from "@/services/api";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const JOB_TITLES = [
  { value: "owner", label: "المالك والمستثمر (Principal Owner)" },
  { value: "manager", label: "مدير عمليات التشغيل (Operations Manager)" },
  {
    value: "accountant",
    label: "المحاسب المالي والإداري (Financial & Admin Accountant)",
  },
  {
    value: "barber",
    label: "أخصائي حلاقة وتصفيف الشعر وعناية باللحية (Master Barber)",
  },
  { value: "colorist", label: "أخصائي تلوين ومعالجة الشعر (Color Specialist)" },
  {
    value: "esthetician",
    label: "أخصائي عناية بالبشرة والوجه (Skin Care Expert)",
  },
  {
    value: "barber_assistant",
    label: "مساعد فني / مسؤول تحضير (Technical Assistant)",
  },
  { value: "cashier", label: "كاشير ومسؤول صندوق (Cashier & POS)" },
  {
    value: "receptionist",
    label: "منسق تجربة العملاء (Guest Experience Coordinator)",
  },
  { value: "cleaner", label: "مسؤول مرافق وتعقيم (Sanitation Officer)" },
  { value: "other", label: "أخرى" },
];

const STATUS_BADGE = {
  suspended: { label: "موقوف إدارياً", variant: "destructive" },
  resigned: { label: "مستقيل", variant: "outline" },
};

export default function EmployeeArchive() {
  const navigate = useNavigate();
  const invalidateEmployees = useInvalidateEmployees();
  const [searchTerm, setSearchTerm] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; [key: string]: unknown } | null>(null);

const { data, isLoading } = useEmployeesArchive<{ id: string; status: string; fullName: string; phonePrimary?: string; jobTitle?: string; hireDate?: string }[]>(
    { limit: 1000 },
    {
      select: (rows) => {
        const list = Array.isArray(rows) ? rows : (rows as unknown as { items?: unknown[] })?.items ?? [];
        return (list as unknown[]).map((e) => normalizeEmployeeRecord(e));
      },
    },
  );

  const employees = useMemo(() => data || [], [data]);

  const handleRestore = async () => {
    if (!confirmTarget) return;
    try {
      setIsActionLoading(true);
      await api.put(`/employees/${confirmTarget.id}`, {
        status: "active",
        isActive: true,
      });
      toast.success("تم استعادة الموظف بنجاح");
      setConfirmTarget(null);
      invalidateEmployees();
    } catch (_error) {
      toast.error("فشل استعادة الموظف");
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter(
      (emp) =>
        emp.fullName?.toLowerCase().includes(query) ||
        emp.phonePrimary?.includes(query) ||
        emp.jobTitle?.toLowerCase().includes(query),
    );
  }, [employees, searchTerm]);

  const stats = useMemo(
    () => ({
      total: employees.length,
      suspended: employees.filter((e) => e.status === "suspended").length,
      resigned: employees.filter((e) => e.status === "resigned").length,
    }),
    [employees],
  );

  return (
    <div className="erp-page-container space-y-8 pb-16" dir="rtl">
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="استعادة الموظف؟"
        description="هل أنت متأكد من رغبتك في استعادة هذا الموظف للعمل؟ سيتم إرجاع كافة صلاحياته وحسابه كـ نشط."
        onConfirm={handleRestore}
        loading={isActionLoading}
      />

      <PageHeader
        title="أرشيف الموظفين"
        subtitle="سجل الموظفين السابقين، المستقيلين، والموقوفين عن العمل."
        badge="سجل الانقطاعات"
        icon={Archive}
        className={undefined}
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/owner/hr")}
            className="w-12 h-12 rounded-2xl bg-soft border-border/60 text-muted hover:text-primary hover:bg-primary/10 hover:border-primary shadow-sm"
          >
            <ChevronRight size={24} />
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الأرشيف"
          value={stats.total}
          icon={Archive}
          variant="primary"
          trend={undefined}
          trendValue={undefined}
          delay={0}
        />
        <StatCard
          label="موقوفين"
          value={stats.suspended}
          icon={UserX}
          variant="danger"
          trend={undefined}
          trendValue={undefined}
          delay={0.05}
        />
        <StatCard
          label="مستقيلين"
          value={stats.resigned}
          icon={History}
          variant="warning"
          trend={undefined}
          trendValue={undefined}
          delay={0.1}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative flex-1 max-w-md group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
            size={18}
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو رقم الجوال..."
            className="h-12 pl-4 pr-12 rounded-xl bg-white border-border focus:border-primary shadow-sm transition-all font-bold text-sm"
          />
        </div>
        <StatCard
          label={`النتائج: ${filteredEmployees.length}`}
          value=""
          icon={Filter}
          variant="info"
          trend={undefined}
          trendValue={undefined}
          delay={0}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-soft animate-pulse border border-border"
            />
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <PremiumCard className="p-12 rounded-[32px] border-dashed border-2 border-border/60 bg-card/50 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-inner">
            <Archive size={40} strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-black text-main mb-2">الأرشيف فارغ</h3>
          <p className="text-sm font-bold text-muted-foreground max-w-md">
            لا يوجد موظفون موقوفون أو مستقيلون في الأرشيف حالياً، أو لا توجد
            نتائج تطابق بحثك.
          </p>
        </PremiumCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <PremiumCard
              key={employee.id}
              className="flex flex-col group overflow-hidden"
              noPadding
              hoverable
            >
              <div className="p-6 space-y-6 flex-1">
                <div className="flex justify-between items-start">
                  <Badge
                    variant={
                      STATUS_BADGE[employee.status]?.variant || "secondary"
                    }
                    className="rounded-xl px-4 py-1.5 font-black uppercase tracking-widest text-[10px]"
                  >
                    {STATUS_BADGE[employee.status]?.label || employee.status}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-black text-main tracking-tight">
                    {employee.fullName}
                  </h3>
                  <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                    <Briefcase size={14} className="text-muted-foreground/70" />
                    {JOB_TITLES.find((j) => j.value === employee.jobTitle)
                      ?.label || employee.jobTitle}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                    <Phone size={16} className="text-main" />
                    <span dir="ltr">{employee.phonePrimary || "---"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                    <Calendar size={16} className="text-main" /> تاريخ التعيين:{" "}
                    <span dir="ltr">
                      {employee.hireDate
                        ? employee.hireDate.split("T")[0]
                        : "---"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-soft/30 border-t border-border/40 mt-auto">
                <Button
                  onClick={() => setConfirmTarget(employee)}
                  className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest bg-white border border-border hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                >
                  <RotateCcw size={18} className="ml-2" /> استعادة للعمل
                </Button>
              </div>
            </PremiumCard>
          ))}
        </div>
      )}
    </div>
  );
}
