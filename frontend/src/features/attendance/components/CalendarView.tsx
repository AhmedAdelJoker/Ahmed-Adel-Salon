/** Attendance Calendar view (moved from AttendanceManagement page, no logic changes). */
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { buildCalendarDays } from "@/features/attendance/utils/attendance";
import type {
  AttendanceRecord,
  WorkingHours,
} from "@/features/attendance/types";

export default function CalendarView({
  records,
  calendarMonth,
  setCalendarMonth,
  workingHours,
}: {
  records: AttendanceRecord[];
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  workingHours: WorkingHours;
}) {
  return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-main flex items-center gap-2">
                <CalendarDays size={20} className="text-primary" /> تقويم الحضور
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                      ),
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="text-sm font-black text-main min-w-[120px] text-center">
                  {calendarMonth.toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                  })}
                </span>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                      ),
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {[
                  "أحد",
                  "إثنين",
                  "ثلاثاء",
                  "أربعاء",
                  "خميس",
                  "جمعة",
                  "سبت",
                ].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-black text-muted py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {buildCalendarDays(records, calendarMonth, workingHours).map((day, i) => (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[60px] rounded-lg border p-1.5 text-center transition-all",
                      day
                        ? day.isToday
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-soft"
                        : "border-transparent",
                      day?.workingHours?.is_open === false && "opacity-40",
                    )}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            "text-[10px] font-black",
                            day.isToday ? "text-primary" : "text-main",
                          )}
                        >
                          {day.day}
                        </span>
                        {day.isToday && day.records.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            <div className="text-[8px] font-bold text-emerald-600">
                              {day.presentCount} حضور
                            </div>
                            {day.lateCount > 0 && (
                              <div className="text-[8px] font-bold text-amber-600">
                                {day.lateCount} تأخير
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
  );
}
