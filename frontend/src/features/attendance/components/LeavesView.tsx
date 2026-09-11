/** Attendance Leaves view (moved from AttendanceManagement page, no logic changes). */
import { motion } from "framer-motion";
import { CheckCircle2, Plane, Plus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import type { LeaveRecord } from "@/features/attendance/types";

export default function LeavesView({
  leaves,
  leaveFilter,
  setLeaveFilter,
  onNewLeave,
  onLeaveAction,
}: {
  leaves: LeaveRecord[];
  leaveFilter: string;
  setLeaveFilter: (v: string) => void;
  onNewLeave: () => void;
  onLeaveAction: (leaveId: string | number | undefined, action: string) => void;
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
                <Plane size={20} className="text-primary" /> إدارة الإجازات
              </h3>
              <div className="flex gap-2">
                <select
                  value={leaveFilter}
                  onChange={(e) => setLeaveFilter(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold"
                >
                  <option value="all">الكل</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="approved">مقبولة</option>
                  <option value="rejected">مرفوضة</option>
                </select>
                <Button
                  className="h-9 rounded-xl text-xs"
                  onClick={onNewLeave}
                >
                  <Plus size={14} className="ml-1" /> طلب جديد
                </Button>
              </div>
            </div>
            {leaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
                <Plane size={40} className="mb-3 text-muted" />
                <p className="text-base font-black text-main">
                  لا توجد طلبات إجازات
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-soft"
                  >
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar name={leave.employee_name} size="md" />
                      <div>
                        <p className="text-sm font-black text-main">
                          {leave.employee_name}
                        </p>
                        <p className="text-[10px] font-bold text-muted">
                          {leave.type === "vacation"
                            ? "إجازة سنوية"
                            : leave.type === "sick"
                              ? "إجازة مرضية"
                              : "أخرى"}{" "}
                          • {leave.start_date} إلى {leave.end_date}
                        </p>
                        {leave.reason && (
                          <p className="text-[9px] font-bold text-muted mt-0.5">
                            السبب: {leave.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          leave.status === "approved"
                            ? "success"
                            : leave.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                        className="text-[9px] font-black"
                      >
                        {leave.status === "approved"
                          ? "مقبول"
                          : leave.status === "rejected"
                            ? "مرفوض"
                            : "قيد الانتظار"}
                      </Badge>
                      {leave.status === "pending" && (
                        <>
                          <Button
                            variant="success"
                            size="sm"
                            className="h-8 rounded-lg text-[10px]"
                            onClick={() =>
                              onLeaveAction(leave.id, "approved")
                            }
                          >
                            <CheckCircle2 size={12} className="ml-1" /> قبول
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-8 rounded-lg text-[10px]"
                            onClick={() =>
                              onLeaveAction(leave.id, "rejected")
                            }
                          >
                            <XCircle size={12} className="ml-1" /> رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
  );
}
