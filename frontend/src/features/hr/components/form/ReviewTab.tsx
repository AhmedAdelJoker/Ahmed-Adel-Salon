/** HR ReviewTab (moved from HRManagement page, no logic changes). */
import type { EmployeeRecord } from "@/types/employee";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, ShieldAlert } from "lucide-react";
import { isCustomJobTitleValue } from "@/features/hr";

export default function ReviewTab({
  formData,
  blueprint,
}: {
  formData: EmployeeRecord;
  blueprint: { title: string };
}) {
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
                      {Number(formData.baseSalary ?? 0).toLocaleString()} ج.م
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
          </div>
  );
}
