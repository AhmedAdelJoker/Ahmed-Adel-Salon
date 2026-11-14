/** HR SystemTab (moved from HRManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import type { EmployeeRecord } from "@/types/employee";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Fingerprint, XCircle } from "lucide-react";
import {
  ROLES,
} from "@/features/hr";
import {
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";
import { validateUsername, passwordRequirements } from "@/features/hr/utils/validators";
import FieldError from "./FieldError";

export default function SystemTab({
  formData,
  setFormData,
  editingEmp,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
  editingEmp: EmployeeRecord | null;
}) {
  const { t } = useTranslation("owner");
  const typedUsername = String(formData.username ?? "").trim();
  const usernameError = typedUsername ? validateUsername(typedUsername, t) : null;
  /*
    Shown once the owner starts typing, and never for "keep the existing
    password" (empty while editing): the checklist is a coaching aid, not a
    gate. The backend's `validate_password_strength` is the actual gate.
  */
  const passwordValue = String(formData.password ?? "");
  const passwordChecks = passwordRequirements(passwordValue, t);

  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl border border-primary/20 bg-primary-soft text-main">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Fingerprint size={24} />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-widest">
                    {t("hr.loginAccount")}
                  </div>
                  <div className="text-xs font-medium text-muted leading-relaxed">
                    {t("hr.enablePermissions")}
                  </div>
                </div>
              </div>
              <Switch
                checked={formData.hasLoginAccount}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, hasLoginAccount: v })
                }
                className="data-[state=checked]:bg-white data-[state=checked]:text-accent"
              />
            </div>

            {formData.hasLoginAccount && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl border border-border bg-soft/50">
                <div className="space-y-2">
                  <label className={FIELD_LABEL_CLASS} htmlFor="employee-username">
                    {t("hr.username")}
                  </label>
                  <Input
                    id="employee-username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                    autoComplete="off"
                    maxLength={30}
                    aria-invalid={Boolean(usernameError)}
                    aria-describedby={usernameError ? "username-error" : undefined}
                  />
                  {usernameError ? (
                    <FieldError id="username-error">{usernameError}</FieldError>
                  ) : (
                    <p className="text-[11px] font-bold text-muted">
                      {t("hr.usernameHint")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className={FIELD_LABEL_CLASS} htmlFor="employee-password">
                    {t("hr.password")}
                  </label>
                  <Input
                    id="employee-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                    autoComplete="new-password"
                    placeholder={
                      editingEmp ? "••••••••" : t("hr.passwordPlaceholder")
                    }
                  />
                  {/*
                    The rules as a live checklist rather than a rejection: the
                    owner sees exactly what the password still needs while
                    typing it, not after the save bounces. Mirrors
                    `validate_password_strength` in the backend.
                  */}
                  {passwordValue.length > 0 && (
                    <ul className="grid grid-cols-2 gap-1.5 pt-1">
                      {passwordChecks.map((check) => (
                        <li
                          key={check.label}
                          className={cn(
                            "flex items-center gap-1.5 text-[11px] font-bold",
                            check.met ? "text-success" : "text-muted",
                          )}
                        >
                          {check.met ? (
                            <CheckCircle2 size={12} className="shrink-0" aria-hidden="true" />
                          ) : (
                            <XCircle size={12} className="shrink-0" aria-hidden="true" />
                          )}
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className={FIELD_LABEL_CLASS}>{t("hr.accessLevel")}</label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                  >
                    <SelectTrigger className={FIELD_SELECT_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {/* The access level, in the reader's language: an
                              English form listing the levels in Arabic told
                              the owner nothing about what they were granting. */}
                          {t(`hr.accessRole.${r.value}`, {
                            defaultValue: r.label,
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className={FIELD_LABEL_CLASS} htmlFor="employee-admin-notes">
                {t("hr.adminNotes")}
              </label>
              <textarea
                id="employee-admin-notes"
                value={formData.personalNotes}
                onChange={(e) =>
                  setFormData({ ...formData, personalNotes: e.target.value })
                }
                className={FIELD_TEXTAREA_CLASS}
                rows={4}
                maxLength={500}
              />
            </div>
          </div>
  );
}
