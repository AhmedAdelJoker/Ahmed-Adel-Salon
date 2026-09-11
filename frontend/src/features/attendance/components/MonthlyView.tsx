/** Attendance Monthly view (moved from AttendanceManagement page, no logic changes). */
import { motion } from "framer-motion";
import { BarChart3, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { cn } from "@/lib/core/utils";
import type { AttendanceRecord } from "@/features/attendance/types";

export default function MonthlyView({ processedData }: { processedData: AttendanceRecord[] }) {
  return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" /> مقارنة
                  الموظفين
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={processedData.map((emp) => ({
                        name: emp.full_name?.split(" ")[0] || "موظف",
                        ساعات: Number(emp.stats?.totalHours) || 0,
                        تأخير: emp.stats?.lateMinutes || 0,
                      }))}
                    >
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
                      <Legend />
                      <Bar
                        dataKey="ساعات"
                        fill="#10b981"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="تأخير"
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4">
                  نسبة الحضور
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "ممتاز (90%+)",
                            value:
                              processedData.filter(
                                (e) =>
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                    100 >=
                                  90,
                              ).length || 1,
                            color: "#10b981",
                          },
                          {
                            name: "جيد (70-89%)",
                            value:
                              processedData.filter((e) => {
                                const r =
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                  100;
                                return r >= 70 && r < 90;
                              }).length || 1,
                            color: "#3b82f6",
                          },
                          {
                            name: "متوسط (50-69%)",
                            value:
                              processedData.filter((e) => {
                                const r =
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                  100;
                                return r >= 50 && r < 70;
                              }).length || 0,
                            color: "#f59e0b",
                          },
                          {
                            name: "ضعيف (<50%)",
                            value:
                              processedData.filter(
                                (e) =>
                                  ((Number(e.stats?.totalHours) || 0) / 8) *
                                    100 <
                                  50,
                              ).length || 0,
                            color: "#ef4444",
                          },
                        ].filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {[
                          { color: "#10b981" },
                          { color: "#3b82f6" },
                          { color: "#f59e0b" },
                          { color: "#ef4444" },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <h3 className="text-sm font-black text-main mb-4">الاتجاهات</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { week: "الأسبوع 1", حضور: 85 },
                        { week: "الأسبوع 2", حضور: 78 },
                        { week: "الأسبوع 3", حضور: 92 },
                        { week: "الأسبوع 4", حضور: 88 },
                      ]}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="opacity-10"
                      />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid var(--border)",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="حضور"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Employee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {processedData.length > 0 ? (
                processedData.map((emp, i) => {
                  const attendanceRate =
                    ((Number(emp.stats?.totalHours) || 0) / 8) * 100;
                  const rateColor =
                    attendanceRate >= 90
                      ? "emerald"
                      : attendanceRate >= 70
                        ? "blue"
                        : attendanceRate >= 50
                          ? "amber"
                          : "rose";
                  return (
                    <motion.div
                      key={emp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "rounded-2xl border bg-card p-5 shadow-soft hover:shadow-premium transition-all",
                        `border-${rateColor}-200 dark:border-${rateColor}-800`,
                      )}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <EmployeeAvatar
                          name={emp.full_name}
                          size="lg"
                          status={attendanceRate >= 70 ? "active" : "inactive"}
                        />
                        <div className="flex-1">
                          <h3 className="text-base font-black text-main">
                            {emp.full_name}
                          </h3>
                          <p className="text-[9px] font-bold text-muted uppercase">
                            ملخص الأداء الشهري
                          </p>
                        </div>
                        <div
                          className={cn(
                            "px-3 py-1.5 rounded-xl",
                            `bg-${rateColor}-50 dark:bg-${rateColor}-900/20`,
                          )}
                        >
                          <span
                            className={cn(
                              "text-sm font-black",
                              `text-${rateColor}-500`,
                            )}
                          >
                            {attendanceRate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-soft">
                          <p className="text-[9px] font-black text-muted uppercase mb-1">
                            إجمالي الساعات
                          </p>
                          <p className="text-xl font-black text-main">
                            {Number(emp.stats?.totalHours) || 0}
                            <small className="text-xs"> ساعة</small>
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-soft">
                          <p className="text-[9px] font-black text-muted uppercase mb-1">
                            صافي المستحق
                          </p>
                          <p className="text-xl font-black text-emerald-600">
                            {emp.payroll?.netSalary || 0}
                            <small className="text-xs"> ج.م</small>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            (emp.stats?.lateMinutes ?? 0) > 0
                              ? "danger"
                              : "secondary"
                          }
                          className="text-[9px] font-black"
                        >
                          {(emp.stats?.lateMinutes ?? 0) > 0
                            ? `${emp.stats?.lateMinutes ?? 0} دقيقة تأخير`
                            : "بدون تأخير"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-black"
                        >
                          {emp.stats?.overtime || 0} ساعة إضافية
                        </Badge>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="md:col-span-2 flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border bg-card">
                  <TrendingUp size={60} className="mb-4 text-muted" />
                  <p className="text-xl font-black text-main">
                    لا توجد بيانات شهرية
                  </p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    لم يتم تسجيل أي بيانات حضور لهذا الشهر
                  </p>
                </div>
              )}
            </div>
          </motion.div>
  );
}
