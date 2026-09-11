/** Attendance Pulse view (moved from AttendanceManagement page, no logic changes). */
import { motion } from "framer-motion";
import { Activity, Clock, Coffee, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { PremiumCard } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { statusLabels } from "@/features/attendance/utils/attendance";
import type {
  AttendanceRecord,
  EmployeeRecord,
} from "@/features/attendance/types";

export default function PulseView({
  todayRecords,
  lateEmployees,
  employees,
}: {
  todayRecords: AttendanceRecord[];
  lateEmployees: AttendanceRecord[];
  employees: EmployeeRecord[];
}) {
  return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Stats Bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "حضور اليوم",
                  value: todayRecords.length,
                  color: "text-[#d3a15c]",
                  icon: UserCheck,
                  bg: "bg-[#d3a15c]/10",
                },
                {
                  label: "المتأخرين",
                  value: lateEmployees.length,
                  color: "text-red-500",
                  icon: Clock,
                  bg: "bg-red-500/10",
                },
                {
                  label: "في استراحة",
                  value: todayRecords.filter((r) => r.status === "break")
                    .length,
                  color: "text-orange-500",
                  icon: Coffee,
                  bg: "bg-orange-500/10",
                },
              ].map((s, i) => (
                <PremiumCard key={i} className="p-6" delay={i * 0.1}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center",
                        s.bg,
                      )}
                    >
                      <s.icon className={s.color} size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                        {s.label}
                      </p>
                      <h4 className="text-3xl font-black text-main tabular-nums">
                        {s.value}
                      </h4>
                    </div>
                  </div>
                </PremiumCard>
              ))}
            </div>

            {/* Employee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todayRecords.length > 0 ? (
                todayRecords.map((rec, i) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-premium transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          imageUrl={
                            (employees.find(
                              (e) => String(e.id) === String(rec.id),
                            )?.profile_image_url as string | undefined)
                          }
                          name={rec.employee_name}
                          size="lg"
                          status={rec.status === "in" ? "active" : "inactive"}
                        />
                        <div>
                          <h3 className="text-base font-black text-main tracking-tight">
                            {rec.employee_name}
                          </h3>
                          <Badge
                            className={cn(
                              "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest mt-1",
                              rec.ai?.color
                                ?.replace("text-", "bg-")
                                .concat("/10"),
                              rec.ai?.color,
                            )}
                          >
                            {rec.ai?.label || "---"}
                          </Badge>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          rec.status === "in"
                            ? "bg-emerald-500 animate-pulse"
                            : rec.status === "break"
                              ? "bg-orange-500 animate-pulse"
                              : "bg-slate-300",
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-soft border border-border/40">
                        <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">
                          حالة الحضور
                        </p>
                        <span className="text-sm font-black text-main">
                          {statusLabels[rec.status ?? ""] || rec.status}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-soft border border-border/40">
                        <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">
                          توقيت القيد
                        </p>
                        <span className="text-sm font-black text-main tabular-nums">
                          {new Date(String(rec.created_at || "")).toLocaleTimeString(
                            "ar-EG",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border/40">
                      <p
                        className={cn(
                          "text-xs font-black uppercase",
                          (rec.stats?.lateMinutes ?? 0) > 0
                            ? "text-red-500"
                            : "text-emerald-600",
                        )}
                      >
                        {(rec.stats?.lateMinutes ?? 0) > 0
                          ? `تأخير: ${rec.stats?.lateMinutes ?? 0} دقيقة`
                          : "انضباط ممتاز"}
                      </p>
                      <Button
                        variant="ghost"
                        className="h-9 px-4 rounded-xl font-black text-[10px] uppercase"
                      >
                        التفاصيل
                      </Button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="md:col-span-2 flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border bg-card">
                  <Activity size={60} className="mb-4 text-muted" />
                  <p className="text-xl font-black text-main">
                    بانتظار تسجيل أول حضور اليوم
                  </p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    لم يتم تسجيل أي حضور حتى الآن
                  </p>
                </div>
              )}
            </div>
          </motion.div>
  );
}
