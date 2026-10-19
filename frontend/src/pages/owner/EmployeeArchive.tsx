import { EmptyState } from "@/components/shared/EmptyState";
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  Search,
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
import { JOB_TITLES } from "@/features/hr";
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

const STATUS_BADGE = {
  // Legacy rows only: "on vacation" now lives in the team list, not here.
  suspended: { label: "في إجازة", variant: "outline" },
  resigned: { label: "ترك العمل", variant: "outline" },
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
      resigned: employees.filter((e) => e.status === "resigned").length,
    }),
    [employees],
  );

  return (
    <div className="erp-page-container space-y-8 pb-16">
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        variant="info"
        title="استعادة الموظف؟"
        confirmText="استعادة"
        description="سيعود الموظف إلى قائمة الفريق كـ نشط. مفاتيح الظهور في الكاشير والحجز تبقى مغلقة حتى تفعّلها من ملفه الشخصي."
        onConfirm={handleRestore}
        loading={isActionLoading}
      />

      <PageHeader
        title="أرشيف الموظفين"
        subtitle="سجل الموظفين الذين تركوا العمل، مع إمكانية الاستعادة في أي وقت."
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
          label="تركوا العمل"
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
            className="h-12 ps-4 pe-12 rounded-xl bg-white border-border focus:border-primary shadow-sm transition-all font-bold text-sm"
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
        <EmptyState
          variant="page"
          icon={Archive}
          title="الأرشيف فارغ"
          message="لا يوجد موظفون في الأرشيف حالياً — الأرشيف لمن تركوا العمل فقط، أو لا توجد نتائج تطابق بحثك."
        />
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
                  <RotateCcw size={18} className="ms-2" /> استعادة للعمل
                </Button>
              </div>
            </PremiumCard>
          ))}
        </div>
      )}
    </div>
  );
}
