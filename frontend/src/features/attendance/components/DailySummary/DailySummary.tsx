import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/core/utils";
import {
  calculateAdvancedHours,
  analyzeProductivity,
} from "@/lib/domain/attendance";
import { Badge } from "@/components/ui/badge";
import { statusConfig, aiConfig, formatTime } from "@/features/attendance";

const DailySummary = ({ todayRecords, employees }) => {
  const summaryData = useMemo(() => {
    return todayRecords.map((rec) => {
      const employee = employees?.find((e) => String(e.id) === String(rec.id));
      const empName =
        rec.employee_name || employee?.full_name || "موظف غير معروف";
      const empImage = employee?.profile_image_url;
      const allLogs = rec.all_logs || [];
      const stats = rec.stats || calculateAdvancedHours(allLogs);
      const ai = rec.ai || analyzeProductivity(stats);
      const aiInfo = aiConfig[ai.label] || aiConfig.poor;

      // Sort logs chronologically
      const sortedLogs = [...allLogs].sort(
        (a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime(),
      );

      // Determine current status (last log)
      const lastLog = sortedLogs[sortedLogs.length - 1];
      const currentStatus = lastLog?.status || "out";
      const statusInfo = statusConfig[currentStatus] || statusConfig.out;

      // Check if has "in" but no "out" yet
      const hasIn = sortedLogs.some((l) => l.status === "in");
      const hasOut = sortedLogs.some((l) => l.status === "out");
      const isActive = hasIn && !hasOut;

      return {
        id: rec.id,
        empName,
        empImage,
        stats,
        ai,
        aiInfo,
        statusInfo,
        currentStatus,
        sortedLogs,
        isActive,
        hasOut,
        lateMinutes: stats.lateMinutes || 0,
        lateReason: rec.late_reason,
      };
    });
  }, [todayRecords, employees]);

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-black text-main">
        <CalendarClock size={16} className="text-accent" /> ملخص اليوم الفوري
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryData.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "relative rounded-2xl border p-4 shadow-soft transition-all hover:shadow-md",
              item.statusInfo.border,
              item.statusInfo.bg,
            )}
          >
            {/* Status indicator on top */}
            <div className="absolute -top-3 left-3 right-3 flex justify-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-card",
                  item.statusInfo.color,
                )}
              >
                <item.statusInfo.icon size={18} className="text-white" />
              </div>
            </div>

            <div className="pt-6 space-y-3">
              {/* Employee Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-soft/50 flex items-center justify-center">
                  {item.empImage ? (
                    <img
                      src={item.empImage}
                      alt={item.empName}
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    <span className="text-xs font-black text-muted">
                      {item.empName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-black text-main">
                    {item.empName}
                  </p>
                  <Badge
                    className={cn(
                      "mt-1 px-2 py-0.5 text-[8px] font-black uppercase",
                      item.aiInfo.bgColor,
                      item.aiInfo.color,
                    )}
                  >
                    {item.aiInfo.icon && (
                      <item.aiInfo.icon size={8} className="ml-0.5" />
                    )}
                    {item.ai.label}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "w-3 h-3 rounded-full",
                    item.isActive
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-slate-300",
                  )}
                />
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
                <div className="text-center">
                  <p className="text-xl font-black text-main">
                    {(Number(item.stats.totalHours) || 0).toFixed(1)}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-muted">
                    ساعات
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-info">
                    {(Number(item.stats.overtime) || 0).toFixed(1)}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-muted">
                    إضافي
                  </p>
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "text-xl font-black",
                      item.stats.lateMinutes > 0
                        ? "text-danger"
                        : "text-emerald-600",
                    )}
                  >
                    {item.stats.lateMinutes || 0}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-muted">
                    تأخير
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-orange-500">
                    {item.stats.breakMinutes || 0}
                  </p>
                  <p className="text-[8px] font-bold uppercase tracking-wider text-muted">
                    استراحة
                  </p>
                </div>
              </div>

              {/* Current Status Badge */}
              <div className="flex items-center justify-center">
                <Badge
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold",
                    item.statusInfo.bg,
                    item.statusInfo.textColor,
                  )}
                >
                  <item.statusInfo.icon size={12} className="ml-1" />{" "}
                  {item.statusInfo.label}
                </Badge>
              </div>

              {/* Timeline Preview - First 3 logs */}
              {item.sortedLogs.length > 0 && (
                <div className="border-t border-border/30 pt-2 space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted">
                    القيود المسجلة:
                  </p>
                  <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
                    {item.sortedLogs.slice(0, 5).map((log, index) => {
                      const logStatus =
                        statusConfig[log.status] || statusConfig.out;
                      return (
                        <div
                          key={log.id || index}
                          className="flex items-center justify-between text-[9px]"
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                logStatus.color,
                              )}
                            />
                            <span className="font-bold text-main">
                              {logStatus.label}
                            </span>
                          </span>
                          <span className="font-bold text-muted tabular-nums">
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                      );
                    })}
                    {item.sortedLogs.length > 5 && (
                      <div className="text-center text-[8px] text-muted pt-1">
                        +{item.sortedLogs.length - 5} قيد آخر
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Late Reason Display */}
              {item.lateReason && (
                <div className="rounded-lg bg-warning/10 border border-warning/20 p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={10} className="text-warning" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-warning">
                      سبب التأخير
                    </span>
                  </div>
                  <p className="text-[9px] font-bold text-main line-clamp-2">
                    {item.lateReason}
                  </p>
                </div>
              )}

              {/* Missing Checkout Warning */}
              {item.stats.hasMissingCheckout && !item.hasOut && (
                <div className="rounded-lg bg-danger/10 border border-danger/20 p-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <AlertCircle size={10} className="text-danger" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-danger">
                      ناقص انصراف
                    </span>
                  </div>
                  <p className="text-[9px] font-bold text-muted">
                    لم يتم تسجيل الانصراف بعد
                  </p>
                </div>
              )}

              {/* Active indicator */}
              {item.isActive && (
                <div className="flex items-center justify-center gap-1.5 text-success">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-wider">
                    متواجد حالياً
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DailySummary;
