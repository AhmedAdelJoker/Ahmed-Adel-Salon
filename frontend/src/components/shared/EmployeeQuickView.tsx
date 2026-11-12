import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  Archive,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Loader2,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { cn } from "@/lib/core/utils";
import { getIntlLocale } from "@/lib/format/locale";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  archiveReasonLabel,
  employmentTypeLabel,
  formatEmployeeDate,
  formatEmployeeMoney,
  jobTitleLabel,
  normalizeEmployeeRecord,
  tenureLabel,
} from "@/features/hr/utils/helpers";
import type { EmployeeRecord } from "@/types/employee";

interface PayrollSnapshot {
  net_salary?: number | string;
  earned_base_salary?: number | string;
  commission_amount?: number | string;
  fixed_deductions?: number | string;
  auto_deduction?: number | string;
  advance_amount?: number | string;
  metrics?: {
    expected_days?: number;
    actual_days?: number;
    attendance_percent?: number;
  };
}

export interface EmployeeQuickViewProps {
  employeeId?: string | number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const statusTone = (status?: string) => {
  if (status === "active") {
    return "border-success-line bg-success-bg text-success-content";
  }
  if (status === "suspended") {
    return "border-warning-line bg-warning-bg text-warning-content";
  }
  return "border-line bg-sunken text-content-tertiary";
};

const statusIcon = (status?: string) => {
  if (status === "active") return CheckCircle2;
  if (status === "suspended") return Clock;
  return XCircle;
};

const statusLabelKey = (status?: string) => {
  if (status === "active") return "hr.statusActive";
  if (status === "suspended") return "hr.statusSuspended";
  return "hr.statusArchived";
};

const toNumber = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const EmployeeQuickView = ({
  employeeId,
  open,
  onOpenChange,
}: EmployeeQuickViewProps) => {
  const { t, i18n } = useTranslation("owner");
  const language = i18n.resolvedLanguage || i18n.language || "ar";
  const locale = getIntlLocale(language);

  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);

  // This dialog is rendered by UIProvider outside the Router tree, so router
  // hooks are unavailable here. Hash navigation works for the app's HashRouter.
  const navigateTo = useCallback((path: string) => {
    window.location.hash = `#${path}`;
  }, []);
  const [payroll, setPayroll] = useState<PayrollSnapshot | null>(null);
  const [penalties, setPenalties] = useState<
    Array<{ penalty_amount: number; is_excused: boolean }> | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payrollUnavailable, setPayrollUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchData = useCallback(async (id: string | number) => {
    setLoading(true);
    setError(null);
    setEmployee(null);
    setPayroll(null);
    setPayrollUnavailable(false);
    setPenalties(null);

    const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
    const [empResult, payrollResult, penaltiesResult] = await Promise.allSettled([
      api.get(`/employees/${id}`),
      api.get(`/payroll/expected-net`, { params: { employee_id: id } }),
      // Optional context: a permission or network failure should not hide the
      // rest of the employee file. The tile simply stays hidden.
      api.get(`/barber-presence/penalties`, { params: { employee_id: id, start_date: monthStart } }),
    ]);

    if (empResult.status === "fulfilled") {
      setEmployee(normalizeEmployeeRecord(empResult.value.data) as EmployeeRecord);
    } else {
      console.error("Employee file fetch error:", empResult.reason);
      setError(t("hr.fileLoadFailed"));
    }

    if (payrollResult.status === "fulfilled") {
      setPayroll(payrollResult.value.data as PayrollSnapshot);
    } else {
      // Payroll is optional context: a permission or temporary failure should not
      // break the employee file itself.
      setPayrollUnavailable(true);
    }

    if (penaltiesResult.status === "fulfilled") {
      setPenalties(Array.isArray(penaltiesResult.value.data) ? penaltiesResult.value.data : []);
    } else {
      setPenalties(null);
    }

    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (open && employeeId != null && employeeId !== "") {
      void fetchData(employeeId);
    }
    if (!open) {
      setEmployee(null);
      setPayroll(null);
      setError(null);
      setPayrollUnavailable(false);
      setPenalties(null);
      setLoading(false);
    }
  }, [open, employeeId, fetchData, reloadKey]);

  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, [open]);

  const tenure = useMemo(
    () => tenureLabel(employee?.hireDate as string | null | undefined, today, t),
    [employee?.hireDate, today, t],
  );

  const hireDateText = useMemo(
    () => formatEmployeeDate(employee?.hireDate, locale),
    [employee?.hireDate, locale],
  );

  const archivedOn = (employee as any)?.archivedOn as string | undefined;
  const archivedDateText = useMemo(
    () => formatEmployeeDate(archivedOn, locale),
    [archivedOn, locale],
  );
  const archiveReason = archiveReasonLabel((employee as any)?.archiveReason, t);

  const phone = String(employee?.phonePrimary || employee?.phone_primary || "").trim();
  const StatusIcon = statusIcon(employee?.status);
  const serviceItems = Array.isArray((employee as any)?.services)
    ? ((employee as any).services as Array<{ id?: string | number; name?: string; name_ar?: string }>)
    : [];
  const name = String(employee?.fullName || employee?.full_name || t("hr.unknownEmployee"));

  const totalDeductions =
    toNumber(payroll?.fixed_deductions) +
    toNumber(payroll?.auto_deduction) +
    toNumber(payroll?.advance_amount);

  // Late penalties this month — active (non-waived) amounts only, so the tile
  // reflects the deduction actually pending against this employee.
  const activePenalties = (penalties || []).filter((p) => !p.is_excused);
  const waivedPenaltyCount = (penalties || []).filter((p) => p.is_excused).length;
  const penaltyTotal = activePenalties.reduce(
    (sum, p) => sum + toNumber(p.penalty_amount),
    0,
  );

  const metrics = payroll?.metrics;
  const canEdit = employee?.id != null;
  const hasId = employeeId != null && employeeId !== "";

  const close = () => onOpenChange?.(false);

  const copyPhone = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast.success(t("hr.phoneCopied"));
    } catch {
      // Clipboard may be unavailable in restricted contexts; keep the UI quiet.
    }
  };

  const goEdit = () => {
    if (!canEdit) return;
    close();
    navigateTo(`/manager/hr?edit=${employee.id}`);
  };

  const goPayroll = () => {
    if (!hasId) return;
    close();
    navigateTo(`/owner/payroll?employeeId=${employeeId}`);
  };

  const goAttendance = () => {
    if (!hasId) return;
    close();
    navigateTo(`/attendance?employeeId=${employeeId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="relative max-h-[92vh] overflow-hidden border border-line-strong/70 bg-card p-0 shadow-premium sm:max-w-[680px] sm:rounded-2xl"
        data-testid="employee-quick-view"
      >
        <DialogTitle className="sr-only">
          {t("hr.fileTitle")}: {name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("hr.fileSubtitle")}
        </DialogDescription>

        <div className="flex max-h-[92vh] flex-col">
          <div
            className="relative border-b border-line px-4 pb-6 pt-4 sm:px-5"
            style={{
              background:
                "radial-gradient(120% 90% at 50% -20%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 62%)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-36"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent), transparent)",
              }}
            />
            <button
              type="button"
              onClick={close}
              className="absolute end-4 top-4 z-10 rounded-lg border border-line/70 bg-card/80 p-2 text-content-tertiary backdrop-blur-sm transition-colors hover:bg-card hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={t("hr.close")}
            >
              <X size={18} />
            </button>

            <div className="relative z-[1] flex flex-col items-center text-center">
              {loading && !employee ? (
                <div className="h-24 w-24 animate-pulse rounded-full border border-line bg-sunken" />
              ) : (
                <div
                  className="relative rounded-full border border-white/20 p-1"
                  style={{
                    boxShadow:
                      "0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent), 0 10px 24px -8px color-mix(in srgb, var(--accent) 35%, transparent)",
                  }}
                >
                  <EmployeeAvatar
                    imageUrl={employee?.profileImageUrl || employee?.profile_image_url}
                    name={name}
                    size="2xl"
                    shape="circle"
                    status={employee?.status}
                    className="shrink-0"
                  />
                </div>
              )}

              <div className="mt-4 min-w-0 max-w-full">
                {loading && !employee ? (
                  <div className="space-y-2">
                    <div className="mx-auto h-6 w-44 animate-pulse rounded bg-sunken" />
                    <div className="mx-auto h-4 w-28 animate-pulse rounded bg-sunken" />
                  </div>
                ) : (
                  <>
                    <h3
                      className="truncate text-lg font-bold leading-tight text-content sm:text-xl"
                      data-testid="employee-file-name"
                    >
                      {name}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-content-secondary">
                      {employee ? jobTitleLabel(employee.jobTitle, t) : t("hr.fileLoading")}
                    </p>
                    {employee && (
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none",
                            statusTone(employee.status),
                          )}
                        >
                          <StatusIcon size={12} />
                          {t(statusLabelKey(employee.status))}
                        </span>
                        {employee.employmentType && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-line bg-raised px-2 py-1 text-[10px] font-semibold text-content-secondary"
                          >
                            {employmentTypeLabel(employee.employmentType, t)}
                          </Badge>
                        )}
                        {hireDateText && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-raised px-2 py-1 text-[10px] font-medium text-content-tertiary">
                            <CalendarDays size={11} className="opacity-70" />
                            {hireDateText}
                          </span>
                        )}
                        {tenure && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-raised px-2 py-1 text-[10px] font-medium text-content-tertiary">
                            {tenure}
                          </span>
                        )}
                        {archivedDateText && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning-line bg-warning-bg px-2 py-1 text-[10px] font-semibold text-warning-content">
                            <Archive size={11} />
                            {archivedDateText}
                          </span>
                        )}
                        {archiveReason && (
                          <span
                            className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-sunken/70 px-2 py-1 text-[10px] font-medium text-content-secondary"
                            title={archiveReason}
                          >
                            {archiveReason}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            {loading && !employee && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-content-secondary" data-testid="employee-file-loading">
                <Loader2 size={18} className="animate-spin text-accent" />
                {t("hr.fileLoading")}
              </div>
            )}

            {!loading && error && !employee && (
              <div className="rounded-xl border border-danger-line bg-danger-bg p-4" data-testid="employee-file-error">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-content">{error}</p>
                    <p className="mt-1 text-xs text-content-secondary">{t("hr.fileLoadFailedHint")}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-lg"
                      onClick={() => hasId && setReloadKey((k) => k + 1)}
                    >
                      <RefreshCw size={14} className="me-1.5" />
                      {t("hr.tryAgain")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {employee && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="rounded-xl border border-line bg-raised p-3.5">
                    <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                      <Wallet size={13} className="text-accent" />
                      {t("hr.salaryAndTerms")}
                    </h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-content-secondary">{t("hr.salaryLabel")}</dt>
                        <dd className="font-mono font-semibold tabular-nums text-content">
                          {formatEmployeeMoney(employee.baseSalary, locale, language)}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-content-secondary">{t("hr.commissionLabel")}</dt>
                        <dd className="font-mono font-semibold tabular-nums text-content">
                          {toNumber(employee.commissionRate)}%
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-content-secondary">{t("hr.jobTitle")}</dt>
                        <dd className="text-end font-medium text-content">
                          {jobTitleLabel(employee.jobTitle, t)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-line bg-raised p-3.5">
                    <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                      <Phone size={13} className="text-accent" />
                      {t("hr.contactInfo")}
                    </h4>
                    <div className="space-y-2">
                      {phone ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-sunken/40 px-3 py-2">
                          <a
                            href={`tel:${phone}`}
                            dir="ltr"
                            className="font-mono text-sm font-semibold text-content hover:text-accent"
                          >
                            {phone}
                          </a>
                          <button
                            type="button"
                            onClick={copyPhone}
                            className="rounded-md p-1.5 text-content-tertiary hover:bg-raised hover:text-content"
                            title={t("hr.copyPhone")}
                            aria-label={t("hr.copyPhone")}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-content-tertiary">{t("hr.noPhone")}</p>
                      )}
                      {employee.email && (
                        <p className="truncate text-xs text-content-secondary" title={String(employee.email)}>
                          {String(employee.email)}
                        </p>
                      )}
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border border-line bg-raised p-3.5" data-testid="employee-file-payroll">
                  <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                    <Activity size={13} className="text-accent" />
                    {t("hr.payrollThisMonth")}
                  </h4>
                  {payroll ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-line bg-sunken/40 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">{t("payroll.expectedNet")}</div>
                        <div className="mt-1 font-mono text-lg font-bold tabular-nums text-content" data-testid="employee-file-net">
                          {formatEmployeeMoney(payroll.net_salary, locale, language)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-line bg-sunken/40 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">{t("hr.attendance")}</div>
                        <div className="mt-1 text-sm font-semibold text-content">
                          {toNumber(metrics?.attendance_percent)}%
                        </div>
                        {metrics && (
                          <div className="text-[10px] text-content-tertiary">
                            {t("hr.daysAttended", {
                              actual: toNumber(metrics.actual_days),
                              expected: toNumber(metrics.expected_days),
                            })}
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg border border-line-subtle bg-card p-2.5 text-xs">
                        <div className="text-content-tertiary">{t("hr.earnedBase")}</div>
                        <div className="font-mono font-semibold tabular-nums text-content">{formatEmployeeMoney(payroll.earned_base_salary, locale, language)}</div>
                      </div>
                      <div className="rounded-lg border border-line-subtle bg-card p-2.5 text-xs">
                        <div className="text-content-tertiary">{t("hr.commissionThisMonth")}</div>
                        <div className="font-mono font-semibold tabular-nums text-content">{formatEmployeeMoney(payroll.commission_amount, locale, language)}</div>
                      </div>
                      <div className="rounded-lg border border-line-subtle bg-card p-2.5 text-xs sm:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-content-tertiary">{t("hr.totalDeductions")}</span>
                          <span className="font-mono font-semibold tabular-nums text-content">{formatEmployeeMoney(totalDeductions, locale, language)}</span>
                        </div>
                      </div>
                      {penalties != null && (
                        <div className="rounded-lg border border-danger-soft bg-danger-soft/40 p-2.5 text-xs sm:col-span-2" data-testid="employee-file-late-penalties">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-content-tertiary">{t("hr.latePenaltiesThisMonth")}</span>
                            <span className="font-mono font-bold tabular-nums text-danger">{formatEmployeeMoney(penaltyTotal, locale, language)}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-content-tertiary">
                            {t("hr.latePenaltiesCount", {
                              count: activePenalties.length,
                            })}
                            {waivedPenaltyCount > 0 && (
                              <> · {t("hr.latePenaltiesWaived", { count: waivedPenaltyCount })}</>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-content-secondary" data-testid="employee-file-payroll-unavailable">
                      {payrollUnavailable ? t("hr.payrollUnavailable") : t("hr.fileLoading")}
                    </p>
                  )}
                </section>

                <section className="rounded-xl border border-line bg-raised p-3.5">
                  <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                    <Briefcase size={13} className="text-accent" />
                    {t("hr.specialties")}
                  </h4>
                  {serviceItems.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {serviceItems.map((s, idx) => (
                        <Badge
                          key={String((s as any)?.id ?? idx)}
                          variant="secondary"
                          className="rounded-md border border-line bg-sunken px-2 py-0.5 text-[10px] font-semibold text-content-secondary"
                        >
                          {(language.startsWith("ar") ? (s as any)?.name_ar : (s as any)?.name) || (s as any)?.name_ar || (s as any)?.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-content-tertiary">{t("hr.noServices")}</p>
                  )}
                </section>

                <section className="rounded-xl border border-line bg-raised p-3.5">
                  <h4 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                    <ShieldCheck size={13} className="text-accent" />
                    {t("hr.visibilityAccess")}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    <VisibilityChip
                      on={employee.showInPos !== false}
                      label={t("hr.rolePos")}
                      t={t}
                    />
                    <VisibilityChip
                      on={employee.showInBooking !== false}
                      label={t("hr.roleBooking")}
                      t={t}
                    />
                    <VisibilityChip
                      on={Boolean(employee.hasLoginAccount || employee.has_login_account)}
                      label={t("hr.roleLogin")}
                      t={t}
                    />
                  </div>
                </section>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-sunken/30 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={goPayroll}
                disabled={!hasId}
              >
                <Wallet size={14} className="me-1.5" />
                {t("hr.payrollSheet")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={goAttendance}
                disabled={!hasId}
              >
                <CalendarDays size={14} className="me-1.5" />
                {t("hr.attendanceRecord")}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-lg bg-accent text-content-on-accent hover:opacity-95"
              onClick={goEdit}
              disabled={!canEdit}
              data-testid="employee-file-edit"
            >
              <Pencil size={14} className="me-1.5" />
              {t("hr.edit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function VisibilityChip({
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
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold",
        on
          ? "border-line bg-raised text-content-secondary"
          : "border-line-subtle bg-sunken text-content-disabled line-through",
      )}
    >
      <Eye size={11} className={on ? "text-success" : "text-content-disabled"} />
      {label}
    </span>
  );
}
