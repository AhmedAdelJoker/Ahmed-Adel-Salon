import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, Clock, Coffee } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import type { AttendanceRecord } from "@/features/attendance/types";
import { WEEKLY_ATTENDANCE } from "@/features/attendance/utils/attendance";

export default function AttendanceDashboardView({
  todayRecords,
}: {
  todayRecords: AttendanceRecord[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Attendance Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" /> الحضور الأسبوعي
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEKLY_ATTENDANCE}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="opacity-10"
                />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="حضور"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="تأخير"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
            <Coffee size={16} className="text-orange-500" /> توزيع الحالات
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    {
                      name: "متواجد",
                      value:
                        todayRecords.filter(
                          (r) =>
                            Number(r.stats?.totalHours) > 0 && !r.isComplete,
                        ).length || 1,
                      color: "#10b981",
                    },
                    {
                      name: "مكتمل",
                      value:
                        todayRecords.filter((r) => r.isComplete).length || 1,
                      color: "#6366f1",
                    },
                    {
                      name: "متأخر",
                      value:
                        todayRecords.filter((r) => (r.stats?.lateMinutes ?? 0) > 0)
                          .length || 0,
                      color: "#f59e0b",
                    },
                  ].filter((d) => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    { name: "متواجد", color: "#10b981" },
                    { name: "مكتمل", color: "#6366f1" },
                    { name: "متأخر", color: "#f59e0b" },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-muted">متواجد</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-bold text-muted">مكتمل</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-[10px] font-bold text-muted">متأخر</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Clock size={16} className="text-primary" /> آخر النشاطات
        </h3>
        <div className="space-y-2">
          {todayRecords.slice(0, 5).map((rec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-xl bg-soft/50 p-3 hover:bg-soft transition-colors"
            >
              <div className="flex items-center gap-3">
                <EmployeeAvatar
                  name={rec.employee_name || rec.barber_name}
                  size="sm"
                  status={rec.isComplete ? "inactive" : "active"}
                />
                <div>
                  <p className="text-xs font-black text-main">
                    {rec.employee_name || rec.barber_name}
                  </p>
                  <p className="text-[9px] font-bold text-muted">
                    {new Date(String(rec.created_at || "")).toLocaleTimeString(
                      "ar-EG",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  (rec.stats?.lateMinutes ?? 0) > 0 ? "danger" : "secondary"
                }
                className="text-[9px] font-black"
              >
                {(rec.stats?.lateMinutes ?? 0) > 0
                  ? `متأخر ${rec.stats?.lateMinutes ?? 0}د`
                  : "طبيعي"}
              </Badge>
            </motion.div>
          ))}
          {todayRecords.length === 0 && (
            <div className="text-center py-8">
              <Activity size={40} className="mx-auto mb-3 text-muted" />
              <p className="text-base font-black text-main">
                لا توجد نشاطات اليوم
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
