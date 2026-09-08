import React, { useState } from "react";
import {
  UserCheck,
  Clock,
  ShieldCheck,
  AlertCircle,
  Award,
  Zap,
  Coffee,
  Eye,
  History,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence } from "framer-motion";

const statusConfig = {
  in: {
    label: "متواجد",
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    icon: UserCheck,
  },
  break: {
    label: "استراحة",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    icon: Coffee,
  },
  break_end: {
    label: "عودة",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    icon: Zap,
  },
  out: {
    label: "انصراف",
    color: "bg-red-500",
    textColor: "text-red-500",
    icon: Clock,
  },
};

const aiConfig = {
  excellent: {
    label: "ممتاز",
    color: "text-success",
    bgColor: "bg-success/10",
    icon: Award,
  },
  good: {
    label: "جيد",
    color: "text-warning",
    bgColor: "bg-warning/10",
    icon: ShieldCheck,
  },
  poor: {
    label: "ضعيف",
    color: "text-danger",
    bgColor: "bg-danger/10",
    icon: AlertCircle,
  },
};

const EmployeeCard = ({ rec, employees }) => {
  const [showDetails, setShowDetails] = useState(false);
  const employee = employees?.find((e) => String(e.id) === String(rec.id));
  const empName = rec.employee_name || employee?.full_name || "موظف غير معروف";
  const empImage = employee?.profile_image_url;
  const status = rec.status || "out";
  const statusInfo = statusConfig[status] || statusConfig.out;
  const ai = rec.ai || {
    label: "ضعيف",
    color: "text-danger",
    bgColor: "bg-danger/10",
  };
  const aiInfo = aiConfig[ai.label] || aiConfig.poor;
  const lateMinutes = rec.stats?.lateMinutes || 0;
  const allLogs = rec.all_logs || [];

  const formatTime = (timestamp) => {
    if (!timestamp) return "--:--";
    return new Date(timestamp).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "--";
    return new Date(timestamp).toLocaleString("ar-EG", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status) => {
    const config = statusConfig[status] || statusConfig.out;
    return config.icon;
  };

  const getStatusLabel = (status) => {
    const config = statusConfig[status] || statusConfig.out;
    return config.label;
  };

  const getStatusColor = (status) => {
    const config = statusConfig[status] || statusConfig.out;
    return config.color.replace("bg-", "text-");
  };

  return (
    <>
      <motion.div
        layout
        className="group relative rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/30 hover:shadow-premium sm:rounded-2xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar
              imageUrl={empImage}
              name={empName}
              size="lg"
              status={status === "in" ? "active" : "inactive"}
            />
            <div className="min-w-0">
              <h3
                className="truncate text-base font-black text-main sm:text-lg"
                title={empName}
              >
                {empName}
              </h3>
              <Badge
                className={cn(
                  "mt-0.5 rounded-md px-2 py-0.5 text-[8px] font-black uppercase tracking-wider sm:text-[9px]",
                  aiInfo.bgColor,
                  aiInfo.color,
                )}
              >
                {aiInfo.icon && <aiInfo.icon size={9} className="ml-0.5" />}
                {ai.label}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div
              className={cn(
                "h-2 w-2 rounded-full animate-pulse",
                statusInfo.color,
              )}
            />
            <span className="text-[10px] font-bold text-muted sm:text-xs">
              {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-xl bg-soft p-2.5 sm:p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
              توقيت القيد
            </p>
            <span className="mt-0.5 block text-xs font-black tabular-nums text-main sm:text-sm">
              {formatTime(rec.created_at)}
            </span>
          </div>
          <div className="rounded-xl bg-soft p-2.5 sm:p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted sm:text-[9px]">
              ساعات العمل
            </p>
            <span className="mt-0.5 block text-xs font-black tabular-nums text-main sm:text-sm">
              {(Number(rec.stats?.totalHours) || 0).toFixed(1)} ساعة
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
          <p
            className={cn(
              "text-[10px] font-black uppercase sm:text-xs",
              lateMinutes > 0 ? "text-danger" : "text-emerald-600",
            )}
          >
            {lateMinutes > 0 ? `تأخير: ${lateMinutes} دقيقة` : "انضباط ممتاز"}
          </p>
          <Button
            variant="ghost"
            className="h-8 rounded-lg px-3 text-[10px] font-black sm:h-9 sm:px-4 sm:text-[11px]"
            onClick={() => setShowDetails(true)}
          >
            <Eye size={12} className="ml-1" /> التفاصيل
          </Button>
        </div>
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetails && (
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader className="border-b border-border/50 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      imageUrl={empImage}
                      name={empName}
                      size="xl"
                      status={status === "in" ? "active" : "inactive"}
                    />
                    <div>
                      <DialogTitle className="text-lg font-black text-main">
                        {empName}
                      </DialogTitle>
                      <DialogDescription className="text-sm text-muted">
                        عرض تفصيلي ليوم{" "}
                        {new Date(rec.created_at).toLocaleDateString("ar-EG", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                      </DialogDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold",
                        statusInfo.bg,
                        statusInfo.textColor,
                      )}
                    >
                      <statusInfo.icon size={12} className="ml-1" />{" "}
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-primary mb-1">
                    إجمالي الساعات
                  </p>
                  <p className="text-xl font-black text-main">
                    {(Number(rec.stats?.totalHours) || 0).toFixed(1)}
                  </p>
                </div>
                <div className="rounded-xl bg-info/5 border border-info/10 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-info mb-1">
                    العمل الإضافي
                  </p>
                  <p className="text-xl font-black text-info">
                    {(Number(rec.stats?.overtime) || 0).toFixed(1)}
                  </p>
                </div>
                <div className="rounded-xl bg-warning/5 border border-warning/10 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-warning mb-1">
                    دقيقة تأخير
                  </p>
                  <p className="text-xl font-black text-warning">
                    {rec.stats?.lateMinutes || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-orange/5 border border-orange/10 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-orange mb-1">
                    دقيقة استراحة
                  </p>
                  <p className="text-xl font-black text-orange">
                    {rec.stats?.breakMinutes || 0}
                  </p>
                </div>
              </div>

              {/* Late Reason if exists */}
              {rec.late_reason && (
                <div className="rounded-xl bg-warning/5 border border-warning/20 p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-warning" />
                    <span className="text-sm font-black text-warning">
                      سبب التأخير
                    </span>
                  </div>
                  <p className="text-sm font-bold text-main">
                    {rec.late_reason}
                  </p>
                </div>
              )}

              {/* Missing Checkout Warning */}
              {rec.stats?.hasMissingCheckout && (
                <div className="rounded-xl bg-danger/5 border border-danger/20 p-3 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} className="text-danger" />
                    <span className="text-sm font-black text-danger">
                      ناقص انصراف!
                    </span>
                  </div>
                  <p className="text-sm font-bold text-muted">
                    لم يتم تسجيل انصراف لهذا اليوم
                  </p>
                </div>
              )}

              {/* Timeline of logs */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-black text-main">
                  <History size={16} className="text-accent" /> التسلسل الزمني
                </h4>
                {allLogs.length > 0 ? (
                  <div className="space-y-2">
                    {allLogs
                      .sort(
                        (a, b) =>
                          new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime(),
                      )
                      .map((log, index) => {
                        const Icon = getStatusIcon(log.status);
                        const color = getStatusColor(log.status);
                        const label = getStatusLabel(log.status);
                        return (
                          <motion.div
                            key={log.id || index}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-soft/50 border border-border/50"
                          >
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                statusConfig[log.status]?.bg?.replace(
                                  "bg-",
                                  "bg-",
                                ) || "bg-primary/10",
                              )}
                            >
                              <Icon size={16} className={color} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-black text-main">
                                {label}
                              </p>
                              <p className="text-[10px] font-bold text-muted">
                                {formatDateTime(log.created_at)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "text-xs font-black px-2 py-1 rounded-lg",
                                statusConfig[log.status]?.bg?.replace(
                                  "bg-",
                                  "bg-",
                                ) || "bg-primary/10",
                                color,
                              )}
                            >
                              {label}
                            </span>
                          </motion.div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-muted text-center py-4">
                    لا توجد قيود مسجلة
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
};

export default EmployeeCard;
