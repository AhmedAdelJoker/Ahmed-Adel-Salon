/** HR AssistantTab (moved from HRManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import type { EmployeeRecord } from "@/types/employee";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity } from "lucide-react";
import { cn } from "@/lib/core/utils";
import {
  ASSISTANT_TASKS,
} from "@/features/hr";
import {
  FIELD_LABEL_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr";

export default function AssistantTab({
  formData,
  setFormData,
  employees,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
  employees: EmployeeRecord[];
}) {
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {formData.jobTitle !== "barber_assistant" && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-4 text-amber-700">
                <Activity className="shrink-0" />
                <p className="text-xs font-bold leading-relaxed">
                  هذا القسم مخصص فقط للموظفين الذين يعملون بصفة "مساعد حلاق"
                  لتحديد المشرف والمهام.
                </p>
              </div>
            )}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  المشرف المباشر (الخبير)
                </label>
                <Select
                  value={String(formData.assistantOfBarberId ?? "")}
                  onValueChange={(v) =>
                    setFormData({ ...formData, assistantOfBarberId: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue placeholder="اختر الخبير المسؤول..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {employees
                      .filter((e) => e.jobTitle === "barber")
                      .map((b) => (
                        <SelectItem key={String(b.id ?? "")} value={(b.id ?? "").toString()}>
                          {b.fullName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className={FIELD_LABEL_CLASS}>المهام التشغيلية</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASSISTANT_TASKS.map((task) => (
                    <button
                      key={task}
                      onClick={() => {
                        const next = (formData.assistantTasksJson ?? []).includes(task)
                          ? (formData.assistantTasksJson ?? []).filter(
                              (t) => t !== task,
                            )
                          : [...(formData.assistantTasksJson ?? []), task];
                        setFormData({ ...formData, assistantTasksJson: next });
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black border transition-all",
                        (formData.assistantTasksJson ?? []).includes(task)
                          ? "bg-accent text-white border-accent shadow-lg shadow-accent/20"
                          : "bg-card text-muted border-border hover:bg-soft",
                      )}
                    >
                      {task}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
  );
}
