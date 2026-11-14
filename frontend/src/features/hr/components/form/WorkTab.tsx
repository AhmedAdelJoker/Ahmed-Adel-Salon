/** HR WorkTab (moved from HRManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import type { EmployeeRecord } from "@/types/employee";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Clock, Calendar, Activity, Info, CalendarOff, AlertCircle } from "lucide-react";
import {
  JOB_TITLES,
  EMPLOYMENT_TYPES,
} from "@/features/hr";
import { isCustomJobTitleValue, isServiceProviderJobTitle } from "@/features/hr";
import { useTranslation } from "react-i18next";
import {
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr";

export default function WorkTab({
  formData,
  setFormData,
  customJobTitle,
  setCustomJobTitle,
  applyJobTitleDefaults,
  hiddenSteps,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
  customJobTitle: boolean;
  setCustomJobTitle: (v: boolean) => void;
  /** Runs role-based default for POS/booking visibility + login account.
   * Deliberately invoked from user actions only — never on form population. */
  applyJobTitleDefaults: (role: string) => void;
  /** Steps this job title does not ask for, each with the reason why. */
  hiddenSteps: Array<{ id: string; label: string; reason: string }>;
}) {
  const { t } = useTranslation("owner");
  // Shown only for fixed-term hires, so an end date before the hire date can
  // only be a typo. Both are `yyyy-mm-dd`, so a string compare is a date compare.
  const contractEnd = String(formData.contractEndDate ?? "").trim();
  const hireDate = String(formData.hireDate ?? "").trim();
  const contractEndError =
    contractEnd && hireDate && contractEnd < hireDate
      ? t("hr.contractEndBeforeHire")
      : null;

  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS} htmlFor="employee-job-title">
                  <Briefcase size={14} /> {t("hr.jobTitle")}
                </label>
                <Select
                  value={
                    customJobTitle || isCustomJobTitleValue(formData.jobTitle)
                      ? "__custom__"
                      : formData.jobTitle
                  }
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setCustomJobTitle(true);
                      setFormData((prev) => ({
                        ...prev,
                        jobTitle: prev.jobTitle && isCustomJobTitleValue(prev.jobTitle) ? prev.jobTitle : "",
                        showInBooking: false,
                      }));
                    } else {
                      setCustomJobTitle(false);
                      // Full role auto-config (visibility toggles, login
                      // account, linked user role) on explicit selection only.
                      applyJobTitleDefaults(v);
                    }
                  }}
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS} id="employee-job-title">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-72 overflow-y-auto">
                    {JOB_TITLES.map((jt) => (
                      <SelectItem key={jt.value} value={jt.value}>
                        {t(jt.labelKey ?? "hr.notSpecified", { defaultValue: jt.label })}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="font-black text-accent">
                      ✍️ {t("hr.jobTitleManual")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {(customJobTitle ||
                  isCustomJobTitleValue(formData.jobTitle)) && (
                  <Input
                    value={
                      isCustomJobTitleValue(formData.jobTitle)
                        ? formData.jobTitle
                        : ""
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        jobTitle: e.target.value,
                      })
                    }
                    className={`${FIELD_INPUT_CLASS} mt-2`}
                    placeholder={t("hr.jobTitleManualPlaceholder")}
                  />
                )}
                {/*
                  The title decides which later steps exist. Warn before the
                  owner has typed a qualification, so dropping the step is not
                  a silent data loss.
                */}
                {hiddenSteps.length > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-[10px] font-bold leading-relaxed text-muted">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {t("hr.hiddenStepsNote")}{" "}
                      {hiddenSteps.map((s) => s.label).join(', ')}.
                      {t("hr.hiddenStepsDataLost")}
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS} htmlFor="employee-contract-type">
                  <Clock size={14} /> {t("hr.contractType")}
                </label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, employmentType: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS} id="employee-contract-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EMPLOYMENT_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {t(et.labelKey ?? "hr.notSpecified", { defaultValue: et.label })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/*
                Only fixed-term hires have a contract that can end. Showing it
                for permanent staff invites an end date to be filled in and then
                quietly ignored, so it appears exactly when it means something.
              */}
              {formData.employmentType !== "full_time" && (
                <div className="space-y-2">
                  <label className={FIELD_LABEL_CLASS} htmlFor="employee-contract-end">
                    <CalendarOff size={14} /> {t("hr.contractEnd")}
                  </label>
                  <Input
                    id="employee-contract-end"
                    type="date"
                    value={String(formData.contractEndDate ?? "")}
                    min={String(formData.hireDate ?? "") || undefined}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contractEndDate: e.target.value,
                      })
                    }
                    className={FIELD_INPUT_CLASS}
                    aria-invalid={Boolean(contractEndError)}
                    aria-describedby={
                      contractEndError ? "contract-end-error" : undefined
                    }
                  />
                  {contractEndError && (
                    <p
                      id="contract-end-error"
                      role="alert"
                      className="flex items-center gap-1.5 text-xs text-red-500"
                    >
                      <AlertCircle size={13} className="shrink-0" />
                      {contractEndError}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS} htmlFor="employee-hire-date">
                  <Calendar size={14} /> {t("hr.hireDate")}
                </label>
                <Input
                  id="employee-hire-date"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) =>
                    setFormData({ ...formData, hireDate: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS} htmlFor="employee-status">
                  <Activity size={14} /> {t("hr.status")}
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS} id="employee-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem
                      value="active"
                      className="text-success font-bold"
                    >
                      {t("hr.statusActive")}
                    </SelectItem>
                    <SelectItem
                      value="suspended"
                      className="text-warning font-bold"
                    >
                      {t("hr.statusSuspended")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                <div>
                  <div className="text-xs font-black text-main">
                    {t("hr.showInPos")}
                  </div>
                  <div className="text-xs font-bold text-muted">
                    {t("hr.showInPosDesc")}
                  </div>
                </div>
                <Switch
                  checked={formData.showInPos}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInPos: v })
                  }
                />
              </div>
              {/*
                The booking switch is only meaningful for service providers —
                the server drops it for everyone else (accountants, cashiers,
                assistants...). Offering a toggle the save would silently
                ignore is worse than explaining why it is not there.
              */}
              {isServiceProviderJobTitle(formData.jobTitle) ? (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                  <div>
                    <div className="text-xs font-black text-main">
                      {t("hr.showInBooking")}
                    </div>
                    <div className="text-xs font-bold text-muted">
                      {t("hr.showInBookingDesc")}
                    </div>
                  </div>
                  <Switch
                    checked={formData.showInBooking}
                    onCheckedChange={(v) =>
                      setFormData({ ...formData, showInBooking: v })
                    }
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2 p-4 rounded-2xl bg-soft border border-border">
                  <Info size={14} className="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <div className="text-xs font-black text-muted">
                      {t("hr.bookingOnline")}
                    </div>
                    <div className="text-xs font-bold text-muted leading-relaxed">
                      {t("hr.bookingOnlineDesc")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}
