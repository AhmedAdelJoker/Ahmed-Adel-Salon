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
import { Fingerprint } from "lucide-react";
import {
  ROLES,
} from "@/features/hr";
import {
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr";

export default function SystemTab({
  formData,
  setFormData,
  editingEmp,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
  editingEmp: EmployeeRecord | null;
}) {
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between p-6 rounded-2xl bg-accent text-white shadow-xl shadow-accent/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Fingerprint size={24} />
                </div>
                <div>
                  <div className="text-sm font-black uppercase tracking-widest">
                    حساب دخول الموظف
                  </div>
                  <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                    تفعيل الصلاحيات التقنية للمنظومة
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
                  <label className={FIELD_LABEL_CLASS}>اسم المستخدم</label>
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className={FIELD_LABEL_CLASS}>كلمة المرور</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                    placeholder={
                      editingEmp ? "••••••••" : "أدخل كلمة المرور..."
                    }
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className={FIELD_LABEL_CLASS}>مستوى الوصول</label>
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
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className={FIELD_LABEL_CLASS}>ملاحظات إدارية</label>
              <textarea
                value={formData.personalNotes}
                onChange={(e) =>
                  setFormData({ ...formData, personalNotes: e.target.value })
                }
                className={FIELD_TEXTAREA_CLASS}
                rows={4}
              />
            </div>
          </div>
  );
}
