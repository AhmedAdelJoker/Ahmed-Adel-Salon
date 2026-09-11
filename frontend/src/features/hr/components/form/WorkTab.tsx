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
import { Briefcase, Clock, Calendar, Activity } from "lucide-react";
import {
  JOB_TITLES,
  EMPLOYMENT_TYPES,
} from "@/features/hr";
import { isCustomJobTitleValue } from "@/features/hr";
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
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
  customJobTitle: boolean;
  setCustomJobTitle: (v: boolean) => void;
}) {
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Briefcase size={14} /> المسمى الوظيفي
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
                      setFormData((prev) => ({
                        ...prev,
                        jobTitle: v,
                        showInBooking: v === "barber",
                      }));
                    }
                  }}
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-72 overflow-y-auto">
                    {JOB_TITLES.map((jt) => (
                      <SelectItem key={jt.value} value={jt.value}>
                        {jt.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__" className="font-black text-accent">
                      ✍️ تسجيل يدوي (مسمى مخصص)
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
                    placeholder="أدخل المسمى الوظيفي يدوياً (مثال: منسق ورديات)..."
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Clock size={14} /> نظام التعاقد
                </label>
                <Select
                  value={formData.employmentType}
                  onValueChange={(v) =>
                    setFormData({ ...formData, employmentType: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EMPLOYMENT_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Calendar size={14} /> تاريخ الالتحاق
                </label>
                <Input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) =>
                    setFormData({ ...formData, hireDate: e.target.value })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Activity size={14} /> الحالة الوظيفية
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem
                      value="active"
                      className="text-emerald-600 font-bold"
                    >
                      نشط
                    </SelectItem>
                    <SelectItem
                      value="suspended"
                      className="text-rose-600 font-bold"
                    >
                      معلّق
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                <div>
                  <div className="text-xs font-black text-main">
                    الظهور في نقطة البيع
                  </div>
                  <div className="text-[10px] font-bold text-muted">
                    إتاحة الموظف في شاشة الدفع
                  </div>
                </div>
                <Switch
                  checked={formData.showInPos}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInPos: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-soft border border-border">
                <div>
                  <div className="text-xs font-black text-main">
                    الظهور في الحجوزات
                  </div>
                  <div className="text-[10px] font-bold text-muted">
                    إتاحة الموظف لجدولة المواعيد
                  </div>
                </div>
                <Switch
                  checked={formData.showInBooking}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInBooking: v })
                  }
                />
              </div>
            </div>
          </div>
  );
}
