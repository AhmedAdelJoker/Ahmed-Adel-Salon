import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  CalendarOff,
  DollarSign,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { useUI } from "@/context/UIContext";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { EmployeePhoto } from "@/components/shared/EmployeePhoto";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import {
  employmentTypeLabel,
  formatEmployeeDate,
  formatEmployeeMoney,
  jobTitleLabel,
} from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

/**
 * Status chip for the team list: active (green), on vacation (amber — still on
 * the team, one tap from coming back), and a muted fallback.
 */
const statusMeta = (status?: string) => {
  if (status === "active") {
    return {
      chip: "border-success-line bg-success-bg text-success-content",
      dot: "bg-success",
    };
  }
  if (status === "suspended") {
    return {
      chip: "border-warning-line bg-warning-bg text-warning-content",
      dot: "bg-warning",
    };
  }
  return {
    chip: "border-line bg-sunken text-content-tertiary",
    dot: "bg-content-tertiary",
  };
};

/**
 * Where this person can actually be reached: the till, the booking site, both,
 * or neither.
 *
 * Shown because it is the thing a green "نشط" chip cannot tell the owner. An
 * employee who came back out of the archive used to read as active here while
 * being invisible at the till and on the booking site — the two switches had
 * been wiped on the way out and the old restore never put them back.
 */
function VisibilityCell({
  showInPos,
  showInBooking,
  t,
}: {
  showInPos: boolean;
  showInBooking: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const parts = [
    { key: "pos", on: showInPos, label: t("hr.rolePos") },
    { key: "booking", on: showInBooking, label: t("hr.roleBooking") },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {parts.map((part) => (
        <span
          key={part.key}
          title={t(part.on ? "hr.visibleIn" : "hr.hiddenFrom", {
            what: part.label,
          })}
          className={
            part.on
              ? "inline-flex items-center gap-1 rounded-md border border-line bg-raised px-1.5 py-0.5 text-[10px] font-semibold text-content-secondary"
              : "inline-flex items-center gap-1 rounded-md border border-line-subtle bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-content-disabled line-through"
          }
        >
          <span
            aria-hidden="true"
            className={
              part.on
                ? "h-1.5 w-1.5 rounded-full bg-success"
                : "h-1.5 w-1.5 rounded-full bg-content-disabled"
            }
          />
          {part.label}
        </span>
      ))}
    </div>
  );
}

/**
 * The roster as a dense table.
 *
 * Same facts as the cards, not a different subset: translated title and
 * employment type, a real local date instead of raw ISO, salary and commission
 * in one column, and the visibility switches the owner needs when someone
 * returns from leave.
 */
export default function EmployeeTable({
  employees,
  onEdit,
  onDelete,
  onArchive,
  hasActiveFilters = false,
  onClearFilters,
  onCreate,
}: {
  employees: EmployeeRecord[];
  onEdit: (emp: any) => void;
  onDelete: (emp: any) => void;
  onArchive: (emp: any) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onCreate?: () => void;
}) {
  const { t, i18n } = useTranslation("owner");
  const language = i18n.resolvedLanguage || i18n.language || "ar";
  const locale = getIntlLocale(language);
  const navigate = useNavigate();
  const { openEmployeeQuickView } = useUI();
  const reduceMotion = useReducedMotion();

  const statusLabel = (status?: string) =>
    status === "active"
      ? t("hr.statusActive")
      : status === "suspended"
        ? t("hr.statusSuspended")
        : t("hr.statusArchived");

  const startedText = (hireDate?: string) => {
    const formatted = formatEmployeeDate(hireDate, locale);
    return formatted ? t("hr.startedOn", { date: formatted }) : null;
  };

  const enterProps = reduceMotion
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  if (employees.length === 0) {
    return (
      <motion.div {...enterProps}>
        <EmptyState
          variant="section"
          icon={Users}
          title={hasActiveFilters ? t("hr.noResultsTitle") : t("hr.noTeamTitle")}
          message={hasActiveFilters ? t("hr.noResultsHint") : t("hr.noTeamHint")}
          action={
            hasActiveFilters && onClearFilters ? (
              <Button
                variant="outline"
                onClick={onClearFilters}
                className="rounded-lg font-semibold"
              >
                {t("hr.clearFilters")}
              </Button>
            ) : onCreate ? (
              <Button
                onClick={onCreate}
                className="rounded-lg bg-accent font-semibold text-content-on-accent"
              >
                <Plus size={16} className="ms-1.5" /> {t("hr.addEmployee")}
              </Button>
            ) : undefined
          }
        />
      </motion.div>
    );
  }

  return (
    <motion.div {...enterProps}>
      <PremiumCard noPadding className="overflow-hidden">
        <div className="hidden overflow-x-auto custom-scrollbar lg:block">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-sunken">
              <TableRow className="border-b border-line bg-sunken text-[10px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">
                <TableHead scope="col" className="px-4 py-2.5">
                  {t("hr.employeeName")}
                </TableHead>
                <TableHead scope="col" className="px-4 py-2.5">
                  {t("hr.jobTitle")}
                </TableHead>
                <TableHead scope="col" className="px-4 py-2.5">
                  {t("hr.phoneLabel")}
                </TableHead>
                <TableHead scope="col" className="px-4 py-2.5">
                  {t("hr.statusLabel")}
                </TableHead>
                <TableHead scope="col" className="px-4 py-2.5">
                  {t("hr.reachableThrough")}
                </TableHead>
                <TableHead scope="col" className="px-4 py-2.5 text-end">
                  {t("hr.salaryLabel")}
                </TableHead>
                <TableHead scope="col" className="px-4 py-2.5 text-center">
                  {t("hr.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-line-subtle">
              {employees.map((emp) => {
                const status = statusMeta(emp.status);
                const started = startedText(emp.hireDate as string);
                const job = jobTitleLabel(emp.jobTitle, t);
                return (
                  <TableRow
                    key={emp.id}
                    className="transition-colors hover:bg-sunken/60"
                  >
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <EmployeePhoto
                          imageUrl={
                            emp.profileImageUrl || emp.profile_image_url
                          }
                          name={emp.fullName}
                          role={job}
                          size="sm"
                          shape="circle"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-content">
                            {emp.fullName}
                          </div>
                          {started && (
                            <div className="text-[10px] font-medium text-content-tertiary">
                              {started}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Badge
                        variant="outline"
                        className="rounded-md border-line bg-sunken text-[10px] font-semibold text-content-secondary"
                      >
                        {job}
                      </Badge>
                      {emp.employmentType && (
                        <div className="mt-1 text-[10px] font-medium text-content-tertiary">
                          {employmentTypeLabel(emp.employmentType, t)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className="px-4 py-2.5 font-mono text-xs tabular-nums text-content-secondary"
                      dir="ltr"
                    >
                      {emp.phonePrimary || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${status.chip}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                        />
                        {statusLabel(emp.status)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <VisibilityCell
                        showInPos={emp.showInPos !== false}
                        showInBooking={emp.showInBooking !== false}
                        t={t}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-end">
                      <div className="font-mono text-xs font-semibold tabular-nums text-content">
                        {formatEmployeeMoney(emp.baseSalary, locale, language)}
                      </div>
                      <div
                        className="text-[10px] font-medium tabular-nums text-content-tertiary"
                        title={t("hr.commissionLabel")}
                      >
                        {emp.commissionRate ?? 0}%
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            emp.id != null && openEmployeeQuickView(emp.id as string | number)
                          }
                          className="h-8 w-8 rounded-md text-content-tertiary hover:text-accent"
                          title={t("hr.openFile")}
                          aria-label={t("hr.openFile")}
                        >
                          <Eye size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(emp)}
                          className="h-8 w-8 rounded-md text-content-tertiary hover:text-content"
                          title={t("hr.edit")}
                          aria-label={t("hr.edit")}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            emp.id !== undefined &&
                            emp.id !== null &&
                            navigate(`/owner/payroll?employeeId=${emp.id}`)
                          }
                          className="h-8 w-8 rounded-md text-success hover:bg-success-bg"
                          title={t("hr.payrollSheet")}
                          aria-label={t("hr.payrollSheet")}
                        >
                          <DollarSign size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(emp)}
                          className={
                            emp.status === "active"
                              ? "h-8 w-8 rounded-md text-warning hover:bg-warning-bg"
                              : "h-8 w-8 rounded-md text-success hover:bg-success-bg"
                          }
                          title={
                            emp.status === "active"
                              ? t("hr.leaveConfirm")
                              : t("hr.returnConfirm")
                          }
                          aria-label={
                            emp.status === "active"
                              ? t("hr.leaveConfirm")
                              : t("hr.returnConfirm")
                          }
                        >
                          {emp.status === "active" ? (
                            <CalendarOff size={15} />
                          ) : (
                            <RotateCcw size={15} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onArchive(emp)}
                          className="h-8 w-8 rounded-md text-danger hover:bg-danger-bg"
                          title={t("hr.archiveTitle")}
                          aria-label={t("hr.archiveTitle")}
                        >
                          <Archive size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile — the same decision data, stacked */}
        <div className="grid grid-cols-1 gap-3 p-3 lg:hidden">
          {employees.map((emp) => {
            const status = statusMeta(emp.status);
            const started = startedText(emp.hireDate as string);
            const job = jobTitleLabel(emp.jobTitle, t);
            return (
              <div
                key={emp.id}
                className="rounded-xl border border-line bg-raised p-4"
              >
                <div className="flex items-start gap-3">
                  <EmployeePhoto
                    imageUrl={emp.profileImageUrl || emp.profile_image_url}
                    name={emp.fullName}
                    role={job}
                    size="sm"
                    shape="circle"
                    hintMissing={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-content">
                      {emp.fullName}
                    </div>
                    <div className="mt-0.5 text-[10px] font-medium text-content-tertiary">
                      {job}
                      {emp.employmentType
                        ? ` · ${employmentTypeLabel(emp.employmentType, t)}`
                        : ""}
                      {started ? ` · ${started}` : ""}
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${status.chip}`}
                  >
                    {statusLabel(emp.status)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <VisibilityCell
                    showInPos={emp.showInPos !== false}
                    showInBooking={emp.showInBooking !== false}
                    t={t}
                  />
                  <span className="text-end font-mono text-xs font-semibold tabular-nums text-content">
                    {formatEmployeeMoney(emp.baseSalary, locale, language)}
                    <span className="block text-[10px] font-medium text-content-tertiary">
                      {emp.commissionRate ?? 0}%
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg font-semibold"
                    onClick={() =>
                      emp.id != null && openEmployeeQuickView(emp.id as string | number)
                    }
                    title={t("hr.openFile")}
                    aria-label={t("hr.openFile")}
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg font-semibold"
                    onClick={() => onEdit(emp)}
                  >
                    <Pencil size={14} className="ms-1" /> {t("hr.edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      emp.status === "active"
                        ? "rounded-lg text-warning"
                        : "rounded-lg text-success"
                    }
                    onClick={() => onDelete(emp)}
                    title={
                      emp.status === "active"
                        ? t("hr.leaveConfirm")
                        : t("hr.returnConfirm")
                    }
                    aria-label={
                      emp.status === "active"
                        ? t("hr.leaveConfirm")
                        : t("hr.returnConfirm")
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
                    className="rounded-lg text-danger"
                    onClick={() => onArchive(emp)}
                    title={t("hr.archiveTitle")}
                    aria-label={t("hr.archiveTitle")}
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
