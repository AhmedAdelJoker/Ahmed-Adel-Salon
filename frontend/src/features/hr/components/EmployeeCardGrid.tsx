import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUI } from "@/context/UIContext";
import {
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeePhoto } from "@/components/shared/EmployeePhoto";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/core/utils";
import {
  employmentTypeLabel,
  formatEmployeeDate,
  formatEmployeeMoney,
  jobTitleLabel,
  tenureLabel,
} from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

/** Local calendar day, so tenure does not drift across a UTC boundary. */
const todayDateOnly = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

function VisibilityFlag({
  on,
  label,
  t,
}: {
  on: boolean;
  label: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <span
      title={t(on ? "hr.visibleIn" : "hr.hiddenFrom", { what: label })}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold",
        on
          ? "border-line bg-raised text-content-secondary"
          : "border-line-subtle bg-sunken text-content-disabled line-through",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          on ? "bg-success" : "bg-content-disabled",
        )}
      />
      {label}
    </span>
  );
}

/**
 * The roster as compact cards.
 *
 * These were `2rem`-radius marketing cards with two large stat boxes and a
 * full-width phone panel; twenty employees produced a page several screens
 * long with no extra information. This version keeps the same facts in roughly
 * half the height: identity and status first, money and reachability second,
 * and the two actions an owner actually uses at the bottom.
 */
export default function EmployeeCardGrid({
  employees,
  onEdit,
  onDelete,
  onArchive,
  onCreate,
  hasActiveFilters = false,
  onClearFilters,
}: {
  employees: EmployeeRecord[];
  onEdit: (emp: any) => void;
  onDelete: (emp: any) => void;
  onArchive: (emp: any) => void;
  onCreate: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}) {
  const { t, i18n } = useTranslation("owner");
  const language = i18n.resolvedLanguage || i18n.language || "ar";
  const locale = getIntlLocale(language);
  const navigate = useNavigate();
  const { openEmployeeQuickView } = useUI();
  const reduceMotion = useReducedMotion();
  const today = todayDateOnly();

  const statusMeta = (status?: string) => {
    if (status === "active") {
      return {
        label: t("hr.statusActive"),
        chip: "border-success-line bg-success-bg text-success-content",
        dot: "bg-success",
        icon: CheckCircle2,
      };
    }
    if (status === "suspended") {
      return {
        label: t("hr.statusSuspended"),
        chip: "border-warning-line bg-warning-bg text-warning-content",
        dot: "bg-warning",
        icon: Clock,
      };
    }
    return {
      label: t("hr.statusArchived"),
      chip: "border-line bg-sunken text-content-tertiary",
      dot: "bg-content-tertiary",
      icon: XCircle,
    };
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
      className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      {employees.length === 0 ? (
        <div className="col-span-full">
          <EmptyState
            variant="section"
            icon={Users}
            title={
              hasActiveFilters ? t("hr.noResultsTitle") : t("hr.noTeamTitle")
            }
            message={
              hasActiveFilters ? t("hr.noResultsHint") : t("hr.noTeamHint")
            }
            action={
              hasActiveFilters && onClearFilters ? (
                <Button
                  variant="outline"
                  onClick={onClearFilters}
                  className="rounded-lg font-semibold"
                >
                  {t("hr.clearFilters")}
                </Button>
              ) : (
                <Button
                  onClick={onCreate}
                  className="rounded-lg bg-accent font-semibold text-content-on-accent"
                >
                  <Plus size={16} className="ms-1.5" /> {t("hr.addEmployee")}
                </Button>
              )
            }
          />
        </div>
      ) : (
        employees.map((emp) => {
          const status = statusMeta(emp.status);
          const StatusIcon = status.icon;
          const job = jobTitleLabel(emp.jobTitle, t);
          const joined = formatEmployeeDate(emp.hireDate, locale);
          const tenure = tenureLabel(emp.hireDate, today, t);
          const employment = emp.employmentType
            ? employmentTypeLabel(emp.employmentType, t)
            : null;
          const hasId = emp.id !== undefined && emp.id !== null;

          return (
            <article
              key={emp.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-premium"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-24"
                style={{
                  background:
                    "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 68%)",
                }}
              />
              <div className="relative p-4">
                <div className="absolute start-3 top-3 z-10">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold shadow-sm backdrop-blur-sm",
                      status.chip,
                    )}
                  >
                    <StatusIcon size={10} aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                <div className="absolute end-2 top-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full border border-line/60 bg-card/70 text-content-tertiary backdrop-blur-sm hover:bg-card hover:text-content"
                        aria-label={t("hr.employeeActions", {
                          name: emp.fullName,
                        })}
                      >
                        <MoreVertical size={15} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-52 rounded-xl border-line bg-card p-1.5 shadow-premium"
                    >
                      <DropdownMenuItem
                        onClick={() => onEdit(emp)}
                        className="rounded-lg py-2.5 font-semibold"
                      >
                        <Pencil size={15} className="ms-2.5 text-accent" />
                        {t("hr.editProfile")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          hasId &&
                          navigate(`/owner/payroll?employeeId=${emp.id}`)
                        }
                        className="rounded-lg py-2.5 font-semibold"
                      >
                        <DollarSign
                          size={15}
                          className="ms-2.5 text-emerald-600"
                        />
                        {t("hr.payrollSheet")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          hasId &&
                          navigate(`/attendance?employeeId=${emp.id}`)
                        }
                        className="rounded-lg py-2.5 font-semibold"
                      >
                        <Clock size={15} className="ms-2.5 text-sky-600" />
                        {t("hr.attendanceRecord")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          hasId &&
                          openEmployeeQuickView(emp.id as string | number)
                        }
                        className="rounded-lg py-2.5 font-semibold"
                      >
                        <Eye size={15} className="ms-2.5 text-indigo-600" />
                        {t("hr.quickView")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1.5" />
                      <DropdownMenuItem
                        onClick={() => onDelete(emp)}
                        className="rounded-lg py-2.5 font-semibold text-amber-600"
                      >
                        {emp.status === "active" ? (
                          <>
                            <Clock size={15} className="ms-2.5" />
                            {t("hr.leaveConfirm")}
                          </>
                        ) : (
                          <>
                            <RotateCcw size={15} className="ms-2.5" />
                            {t("hr.returnConfirm")}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onArchive(emp)}
                        className="rounded-lg py-2.5 font-semibold text-rose-600"
                      >
                        <Archive size={15} className="ms-2.5" />
                        {t("hr.archiveButton")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-col items-center pt-5 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      hasId && openEmployeeQuickView(emp.id as string | number)
                    }
                    disabled={!hasId}
                    className="group/avatar rounded-full transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default disabled:hover:scale-100"
                    title={t("hr.openFile")}
                    aria-label={t("hr.openFile")}
                  >
                    <div
                      className="rounded-full p-1"
                      style={{
                        boxShadow:
                          "0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent), 0 8px 20px -10px color-mix(in srgb, var(--accent) 30%, transparent)",
                      }}
                    >
                      <EmployeePhoto
                        imageUrl={emp.profileImageUrl || emp.profile_image_url}
                        name={emp.fullName}
                        role={job}
                        size="lg"
                        shape="circle"
                        hintMissing
                        expandable={false}
                      />
                    </div>
                  </button>
                  <h3 className="mt-3 max-w-full truncate px-2 text-sm font-bold leading-tight text-content">
                    {emp.fullName}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                    <span className="inline-flex items-center rounded-full border border-line bg-sunken/70 px-2 py-0.5 text-[10px] font-semibold text-content-secondary">
                      {job}
                    </span>
                    {employment && (
                      <span className="text-[10px] font-medium text-content-tertiary">
                        {employment}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-line-subtle bg-sunken/50 px-2.5 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">
                      <Wallet size={11} className="text-success" aria-hidden="true" />
                      {t("hr.salaryLabel")}
                    </div>
                    <div className="mt-1 truncate font-mono text-xs font-semibold tabular-nums text-content">
                      {formatEmployeeMoney(emp.baseSalary, locale, language)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-line-subtle bg-sunken/50 px-2.5 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">
                      <TrendingUp
                        size={11}
                        className="text-warning"
                        aria-hidden="true"
                      />
                      {t("hr.commissionLabel")}
                    </div>
                    <div className="mt-1 font-mono text-xs font-semibold tabular-nums text-content">
                      {emp.commissionRate ?? 0}%
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  <VisibilityFlag
                    on={emp.showInPos !== false}
                    label={t("hr.rolePos")}
                    t={t}
                  />
                  <VisibilityFlag
                    on={emp.showInBooking !== false}
                    label={t("hr.roleBooking")}
                    t={t}
                  />
                  <VisibilityFlag
                    on={Boolean(emp.hasLoginAccount)}
                    label={t("hr.roleLogin")}
                    t={t}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] font-medium text-content-tertiary">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={11} aria-hidden="true" />
                    {joined
                      ? t("hr.joinedOn", { date: joined })
                      : t("hr.notSpecified")}
                  </span>
                  {tenure && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} aria-hidden="true" />
                      {tenure}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-line-subtle pt-3">
                  {emp.phonePrimary ? (
                    <a
                      href={`tel:${emp.phonePrimary}`}
                      dir="ltr"
                      className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-line bg-sunken/40 px-2.5 py-2 font-mono text-[11px] font-medium tabular-nums text-content-secondary transition-colors hover:border-accent/30 hover:text-content"
                    >
                      <Phone size={12} className="shrink-0" aria-hidden="true" />
                      {emp.phonePrimary}
                    </a>
                  ) : (
                    <span className="flex-1 text-[11px] text-content-tertiary">
                      —
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      hasId && openEmployeeQuickView(emp.id as string | number)
                    }
                    disabled={!hasId}
                    className="h-9 rounded-xl border-line px-2.5 text-[11px] font-semibold"
                  >
                    <Eye size={13} className="ms-1" aria-hidden="true" />
                    {t("hr.openFile")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onEdit(emp)}
                    className="h-9 rounded-xl bg-accent px-2.5 text-[11px] font-semibold text-content-on-accent shadow-sm"
                  >
                    <Pencil size={13} className="ms-1" aria-hidden="true" />
                    {t("hr.edit")}
                  </Button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </motion.div>
  );
}
