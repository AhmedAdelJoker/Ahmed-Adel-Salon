import React from "react";
import { History, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/core/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { statusConfig } from "@/features/attendance/components/EmployeeCard/constants";

interface EmployeeCardDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rec: any;
  empName: string;
  empImage?: string;
  status: string;
  statusInfo: {
    label: string;
    color: string;
    textColor: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    bg?: string;
  };
}

export function EmployeeCardDetailsDialog({
  open,
  onOpenChange,
  rec,
  empName,
  empImage,
  status,
  statusInfo,
}: EmployeeCardDetailsDialogProps) {
  const allLogs = rec.all_logs || [];

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "--";
    return new Date(timestamp).toLocaleString("ar-EG", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (s: string) => {
    const config = (statusConfig as any)[s] || (statusConfig as any).out;
    return config.icon;
  };

  const getStatusLabel = (s: string) => {
    const config = (statusConfig as any)[s] || (statusConfig as any).out;
    return config.label;
  };

  const getStatusColor = (s: string) => {
    const config = (statusConfig as any)[s] || (statusConfig as any).out;
    return config.color.replace("bg-", "text-");
  };

  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                      (statusInfo as any).bg,
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
                <p className="text-sm font-bold text-main">{rec.late_reason}</p>
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
                      (a: any, b: any) =>
                        new Date(String(a.created_at)).getTime() -
                        new Date(String(b.created_at)).getTime(),
                    )
                    .map((log: any, index: number) => {
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
                              (statusConfig as any)[log.status]?.bg?.replace(
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
                              (statusConfig as any)[log.status]?.bg?.replace(
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
  );
}

export default EmployeeCardDetailsDialog;
