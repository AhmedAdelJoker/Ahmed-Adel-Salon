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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("owner");
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {formData.jobTitle !== "barber_assistant" && (
              <div className="p-4 rounded-2xl bg-warning-soft border border-warning/20 flex gap-4 text-warning">
                <Activity className="shrink-0" />
                <p className="text-xs font-bold leading-relaxed">
                  {t("hr.assistantOnly")}
                </p>
              </div>
            )}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  {t("hr.supervisor")}
                </label>
                <Select
                  value={String(formData.assistantOfBarberId ?? "")}
                  onValueChange={(v) =>
                    setFormData({ ...formData, assistantOfBarberId: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue placeholder={t("hr.selectSupervisor")} />
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
                <label className={FIELD_LABEL_CLASS}>{t("hr.operationalTasks")}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASSISTANT_TASKS.map((task) => {
                    const selected = (formData.assistantTasksJson ?? []).includes(task.value);
                    return (
                      <button
                        key={task.value}
                        onClick={() => {
                          const next = selected
                            ? (formData.assistantTasksJson ?? []).filter(
                                (value) => value !== task.value,
                              )
                            : [...(formData.assistantTasksJson ?? []), task.value];
                          setFormData({ ...formData, assistantTasksJson: next });
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-black border transition-all",
                          selected
                            ? "bg-primary-soft text-primary border-primary/40 shadow-sm"
                            : "bg-card text-muted border-border hover:bg-soft",
                        )}
                      >
                        {t(task.labelKey, { defaultValue: task.value })}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
  );
}
