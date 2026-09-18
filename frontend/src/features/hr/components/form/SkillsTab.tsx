/** HR SkillsTab (moved from HRManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import type { EmployeeRecord } from "@/types/employee";
import type { ServiceRecord } from "@/types/catalog";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/core/utils";

export default function SkillsTab({
  allServices,
  formData,
  setFormData,
}: {
  allServices: ServiceRecord[];
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
}) {
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="p-6 rounded-[2rem] bg-accent/5 border border-accent/10 flex items-center gap-6">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
                <Scissors size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-main">
                  المؤهلات والخدمات
                </h3>
                <p className="text-xs font-bold text-muted mt-1">
                  حدد الخدمات التي يتقنها الموظف ليتم عرضها له ديناميكياً في
                  شاشة الـ POS والحجوزات.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
              {allServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    const currentIds = (formData.serviceIds as (string | number)[]) ?? [];
                    const sid = service.id as string | number;
                    const next = currentIds.includes(sid)
                      ? currentIds.filter((id) => id !== sid)
                      : [...currentIds, sid];
                    setFormData({ ...formData, serviceIds: next });
                  }}
                  className={cn(
                    "flex flex-col p-4 rounded-2xl border transition-all text-right group",
                    ((formData.serviceIds as (string | number)[]) ?? []).includes(service.id as string | number)
                      ? "bg-primary-soft border-primary/40 text-primary shadow-sm"
                      : "bg-card border-border hover:border-accent/40",
                  )}
                >
                  <div
                    className={cn(
                      "text-[13px] font-black",
                      ((formData.serviceIds as (string | number)[]) ?? []).includes(service.id as string | number)
                        ? "text-primary"
                        : "text-main group-hover:text-accent",
                    )}
                  >
                    {service.name_ar || service.name}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-bold mt-1",
                      ((formData.serviceIds as (string | number)[]) ?? []).includes(service.id as string | number)
                        ? "text-white/70"
                        : "text-muted",
                    )}
                  >
                    {service.category} • {service.price} ج.م
                  </div>
                </button>
              ))}
            </div>
          </div>
  );
}
