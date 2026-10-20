/** HR ReviewTab (moved from HRManagement page, no logic changes). */
import type { EmployeeRecord } from "@/types/employee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/core/utils";
import { cn } from "@/lib/core/utils";
import { CheckCircle2, ShieldCheck, ShieldAlert } from "lucide-react";
import { isCustomJobTitleValue, EMPLOYMENT_TYPES } from "@/features/hr";

/** `yyyy-mm-dd` (or an ISO datetime) as a short readable date, local time. */
function formatReviewDate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function employmentTypeLabel(value: unknown): string {
  const found = EMPLOYMENT_TYPES.find((t) => t.value === String(value ?? ""));
  return found?.label ?? String(value ?? "—");
}

/**
 * The contract end date, flagged when it is close.
 *
 * A date in the past is shown in warning colour rather than being hidden or
 * silently corrected: the most likely causes are a contract already renewed, or
 * a typo the owner should see now rather than discover at payroll.
 */
function contractEndSummary(value: unknown): { text: string; imminent: boolean } | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { text: raw, imminent: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((parsed.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { text: `${formatReviewDate(raw)} (منتهٍ)`, imminent: true };
  if (days <= 30) return { text: `${formatReviewDate(raw)} (${days} يوم)`, imminent: true };
  return { text: formatReviewDate(raw), imminent: false };
}

export default function ReviewTab({
  formData,
  blueprint,
  onSubmit,
  isActionLoading,
  isEditing,
}: {
  formData: EmployeeRecord;
  blueprint: { title: string };
  /** Final approval. Lives here because this is the step the owner is on. */
  onSubmit: () => void | Promise<void>;
  isActionLoading: boolean;
  isEditing: boolean;
}) {
  /*
    What the skills and assistant steps captured. `serviceIds` is the source of
    truth while filling the form; `services` (with names) is only populated once
    the record has been loaded, so both are read and the count falls back to the
    ids when there are no names to show.
  */
  const serviceIds = Array.isArray(formData.serviceIds) ? formData.serviceIds : [];
  const serviceObjects = Array.isArray(formData.services) ? formData.services : [];
  const serviceSummary =
    serviceIds.length > 0 || serviceObjects.length > 0
      ? {
          count:
            serviceIds.length || serviceObjects.length,
          names: serviceObjects
            .map((s) =>
              typeof s === "object" && s
                ? String(
                    (s as Record<string, unknown>).name ??
                      (s as Record<string, unknown>).name_ar ??
                      "",
                  )
                : "",
            )
            .filter(Boolean),
        }
      : null;

  /*
    Assistant tasks are stored as plain Arabic labels (`ASSISTANT_TASKS` is a
    string list, not ids), so they display as-is. An unrecognised entry is
    still shown rather than dropped — it is the owner who typed it, and hiding
    it here would make the summary disagree with the step above it.
  */
  const assistantTaskNames = (
    Array.isArray(formData.assistantTasksJson) ? formData.assistantTasksJson : []
  )
    .map((task) =>
      typeof task === "object" && task
        ? String(
            (task as Record<string, unknown>).label ??
              (task as Record<string, unknown>).id ??
              "",
          )
        : String(task ?? ""),
    )
    .filter(Boolean);

  const contractEnd = contractEndSummary(formData.contractEndDate);

  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-3">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
                <CheckCircle2
                  size={48}
                  strokeWidth={3}
                  className="animate-bounce"
                />
              </div>
              <h3 className="text-2xl font-black text-main">
                مراجعة البيانات النهائية
              </h3>
              <p className="text-sm font-bold text-muted">
                يرجى التدقيق في بيانات الكادر قبل الاعتماد النهائي.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                  الهوية والعمل
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">الاسم:</span>
                    <span className="text-xs font-black text-main">
                      {formData.fullName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      المسمى:
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs font-black uppercase"
                    >
                      {isCustomJobTitleValue(formData.jobTitle) && formData.jobTitle
                        ? formData.jobTitle
                        : blueprint.title}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      الجوال:
                    </span>
                    <span className="text-xs font-black text-main" dir="ltr">
                      {formData.phonePrimary}
                    </span>
                  </div>
                  {formData.email ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        البريد:
                      </span>
                      <span
                        className="text-xs font-black text-main truncate"
                        dir="ltr"
                        title={String(formData.email)}
                      >
                        {formData.email}
                      </span>
                    </div>
                  ) : null}
                  {/*
                    The national id and birth date are the two fields payroll and
                    government paperwork actually ask for, and they were absent
                    from the last screen before approval. Approving without them
                    on screen meant approving blind.
                  */}
                  {formData.nationalId ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        رقم الهوية:
                      </span>
                      <span className="text-xs font-black text-main" dir="ltr">
                        {String(formData.nationalId)}
                      </span>
                    </div>
                  ) : null}
                  {formData.birthDate ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        تاريخ الميلاد:
                      </span>
                      <span className="text-xs font-black text-main">
                        {formatReviewDate(formData.birthDate)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4">
                    <span className="text-xs font-bold text-muted shrink-0">
                      تاريخ الالتحاق:
                    </span>
                    <span className="text-xs font-black text-main">
                      {formatReviewDate(formData.hireDate) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      نظام التعاقد:
                    </span>
                    <span className="text-xs font-black text-main">
                      {employmentTypeLabel(formData.employmentType)}
                    </span>
                  </div>
                  {/*
                    A contract end date is only meaningful for a fixed term, and
                    only alarming when it is near. Showing it unconditionally
                    would train the owner to ignore the row.
                  */}
                  {contractEnd && contractEnd.imminent && (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        انتهاء العقد:
                      </span>
                      <span
                        className={cn(
                          "text-xs font-black",
                          contractEnd.imminent ? "text-warning" : "text-main",
                        )}
                      >
                        {contractEnd.text}
                      </span>
                    </div>
                  )}
                  {formData.department ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        القسم:
                      </span>
                      <span className="text-xs font-black text-main truncate">
                        {formData.department}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                  الهيكل المالي
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      الراتب الأساسي:
                    </span>
                    <span className="text-xs font-black text-success">
                      {formatCurrency(formData.baseSalary ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      العمولة:
                    </span>
                    <span className="text-xs font-black text-main">
                      {formData.commissionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      طريقة الصرف:
                    </span>
                    <span className="text-xs font-black text-main uppercase">
                      {formData.paymentMethod}
                    </span>
                  </div>
                  {String(formData.paymentMethod ?? "") === "wallet" &&
                  formData.walletNumber ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        رقم المحفظة:
                      </span>
                      <span className="text-xs font-black text-main" dir="ltr">
                        {String(formData.walletNumber)}
                      </span>
                    </div>
                  ) : null}
                  {String(formData.paymentMethod ?? "") === "bank" &&
                  formData.bankAccount ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        الحساب البنكي:
                      </span>
                      <span
                        className="text-xs font-black text-main truncate"
                        dir="ltr"
                        title={String(formData.bankAccount)}
                      >
                        {String(formData.bankAccount)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/*
                The review step is the last thing the owner sees before a save,
                and it used to show three things: name, title, salary. Everything
                typed in the skills and assistant steps — the parts that decide
                who can be booked for what, and who gets commission — did not
                appear here at all, so approving meant approving a summary that
                omitted the actual decision.
              */}
              {serviceSummary && (
                <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                  <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                    المؤهلات والخدمات
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        الخدمات المسجلة:
                      </span>
                      <span className="text-xs font-black text-main">
                        {serviceSummary.count} خدمة
                      </span>
                    </div>
                    {serviceSummary.names.length > 0 && (
                      <p className="text-[11px] font-bold leading-relaxed text-muted">
                        {serviceSummary.names.join("، ")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formData.assistantOfBarberId ? (
                <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                  <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                    نظام المساعدين
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        مرتبط بالحلاق رقم:
                      </span>
                      <span className="text-xs font-black text-main" dir="ltr">
                        {formData.assistantOfBarberId}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-muted shrink-0">
                        يستحق عمولة:
                      </span>
                      <span className="text-xs font-black text-main">
                        {formData.receivesCommission ? "نعم" : "لا"}
                      </span>
                    </div>
                    {assistantTaskNames.length > 0 && (
                      <p className="text-[11px] font-bold leading-relaxed text-muted">
                        المهام: {assistantTaskNames.join("، ")}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/*
                POS and booking visibility decide whether this person shows up
                to customers at all. Worth seeing on the last screen.
              */}
              <div className="rounded-3xl border border-border bg-soft/30 p-6 space-y-4">
                <h4 className="text-xs font-black text-muted uppercase tracking-[0.2em] border-b border-border pb-2">
                  الظهور والحالة
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      في نقاط البيع:
                    </span>
                    <span className="text-xs font-black text-main">
                      {formData.showInPos === false ? "مخفي" : "ظاهر"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      في الحجز الإلكتروني:
                    </span>
                    <span className="text-xs font-black text-main">
                      {formData.showInBooking === false ? "مخفي" : "ظاهر"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-muted">
                      الحالة:
                    </span>
                    <span className="text-xs font-black text-main">
                      {formData.status || "active"}
                    </span>
                  </div>
                </div>
              </div>

              {formData.hasLoginAccount && (
                <div className="md:col-span-2 rounded-3xl border border-accent/20 bg-accent/5 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-main">
                        حساب النظام جاهز
                      </h4>
                      <p className="text-xs font-bold text-muted">
                        اسم المستخدم:{" "}
                        <span className="font-black text-accent">
                          {formData.username}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-primary-soft text-primary border border-primary/20 font-black text-xs uppercase tracking-widest">
                    {formData.role} ACCESS
                  </Badge>
                </div>
              )}
            </div>

            {!formData.hasLoginAccount &&
              ["manager", "accountant", "cashier"].includes(
                formData.jobTitle ?? "",
              ) && (
                <div className="p-4 rounded-2xl bg-warning-soft border border-warning/20 flex items-start gap-3 text-warning">
                  <ShieldAlert size={20} />
                  <p className="text-sm font-bold leading-relaxed">
                    تحذير: لا يمكن لهذا الدور العمل بدون حساب نظام. يرجى العودة
                    لخطوة "بوابة النظام".
                  </p>
                </div>
              )}

          {/*
            The approval action sits on the review step, which is the step the
            owner is actually looking at when they decide. It used to be only in
            the desktop sidebar, so on a phone the way to finish the form was a
            button in a column that was not on screen.
          */}
          <div className="pt-8 border-t border-border">
            <Button
              onClick={onSubmit}
              disabled={isActionLoading}
              loading={isActionLoading}
              className="h-14 w-full rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:bg-accent/90 transition-all active:scale-[0.99]"
            >
              <CheckCircle2 size={18} className="ms-2" aria-hidden="true" />
              {isActionLoading
                ? "جاري الاعتماد..."
                : isEditing
                  ? "قبول التعديلات"
                  : "قبول الموظف الجديد"}
            </Button>
            <p className="mt-3 text-center text-[11px] font-bold leading-relaxed text-muted">
              بالضغط على "قبول" يتم اعتماد البيانات وحفظها في المنظومة.
            </p>
          </div>
          </div>
  );
}