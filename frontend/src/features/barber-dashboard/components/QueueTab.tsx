import { Clock, CheckCircle, Play, Zap, Scissors, Activity, UserCheck, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";

interface QueueRow {
  id: string | number;
  status: string;
  customer_name?: string | null;
  service_name?: string | null;
  start_time?: string | null;
  isWaiting?: boolean;
  [key: string]: unknown;
}

interface QueueTabProps {
  queueRows: QueueRow[];
  waitingCount: number;
  completedCount: number;
  fetchDashboardData: () => void | Promise<void>;
  handleStatusChange: (id: string | number, status: string) => void | Promise<void>;
}

export const QueueTab = ({
  queueRows,
  waitingCount,
  completedCount,
  fetchDashboardData,
  handleStatusChange,
}: QueueTabProps) => {
  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-warning/20 bg-warning/5 p-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-warning" />
            <span className="text-[10px] font-bold text-muted">في الانتظار</span>
          </div>
          <p className="text-2xl font-black text-warning mt-1">{waitingCount}</p>
        </div>
        <div className="rounded-xl border border-success/20 bg-success/5 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-success" />
            <span className="text-[10px] font-bold text-muted">مكتمل</span>
          </div>
          <p className="text-2xl font-black text-success mt-1">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <UserCheck size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted">الإجمالي</span>
          </div>
          <p className="text-2xl font-black text-primary mt-1">{queueRows.length}</p>
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-black text-main flex items-center gap-2">
            <Zap size={16} className="text-primary animate-pulse" /> قائمة العمليات المباشرة
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchDashboardData}>
            <RefreshCw size={14} />
          </Button>
        </div>
        <div className="divide-y divide-border">
          {queueRows.length > 0 ? (
            <AnimatePresence>
              {queueRows.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 hover:bg-soft/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          item.status === "waiting"
                            ? "bg-warning/10 text-warning"
                            : item.status === "in-service"
                              ? "bg-info/10 text-info"
                              : "bg-success/10 text-success",
                        )}
                      >
                        {item.status === "waiting" ? (
                          <Clock size={18} />
                        ) : item.status === "in-service" ? (
                          <Scissors size={18} />
                        ) : (
                          <CheckCircle size={18} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-main">
                          {item.customer_name || "عميل نقدي"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="h-5 px-2 text-[8px] font-black">
                            {item.service_name || "خدمة صالون"}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted">
                            {item.start_time
                              ? new Date(item.start_time).toLocaleTimeString("ar-EG", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "--:--"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "waiting" ? (
                        <Button
                          size="sm"
                          className="h-9 rounded-xl px-4 text-[10px] font-black"
                          onClick={() => handleStatusChange(item.id, "in-service")}
                        >
                          <Play size={12} className="ml-1" /> بدء
                        </Button>
                      ) : item.status === "in-service" ? (
                        <Button
                          size="sm"
                          variant="success"
                          className="h-9 rounded-xl px-4 text-[10px] font-black"
                          onClick={() => handleStatusChange(item.id, "completed")}
                        >
                          <CheckCircle size={12} className="ml-1" /> إنهاء
                        </Button>
                      ) : (
                        <Badge variant="success" className="h-7 px-3 text-[10px] font-black">
                          <CheckCircle size={10} className="ml-1" /> مكتمل
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="p-8 text-center">
              <Activity size={40} className="mx-auto mb-3 text-muted" />
              <p className="text-sm font-black text-main">لا توجد حجوزات</p>
              <p className="text-xs font-bold text-muted">لم يتم إسناد أي عملاء لقائمتك حالياً</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
