/** Attendance Archive view (moved from AttendanceManagement page, no logic changes). */
import { motion } from "framer-motion";
import { History, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  statusColors,
  statusLabels,
} from "@/features/attendance/utils/attendance";
import type { AttendanceRecord } from "@/features/attendance/types";

export default function ArchiveView({
  archiveRecords,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  archiveRecords: AttendanceRecord[];
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}) {
  return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Filters */}
            <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
                    size={14}
                  />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="البحث في الأرشيف..."
                    className="h-10 w-full pr-9 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 w-full text-xs font-bold"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 w-full text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Archive Table */}
            <div className="overflow-hidden rounded-2xl border overflow-x-auto custom-scrollbar border-border bg-card shadow-soft">
              {archiveRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
                  <History size={40} className="text-muted" />
                  <div>
                    <p className="text-base font-black text-main">
                      لا توجد سجلات
                    </p>
                    <p className="mt-1 text-xs font-bold text-muted">
                      جرّب تغيير نطاق التاريخ أو معايير البحث
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">
                          الموظف
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">
                          نوع العملية
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">
                          التاريخ والوقت
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">
                          الحالة
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archiveRecords.slice(0, 50).map((rec, i) => (
                        <TableRow
                          key={i}
                          className="hover:bg-soft/50 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <EmployeeAvatar
                                name={rec.employee_name}
                                size="sm"
                              />
                              <span className="font-black text-main">
                                {rec.employee_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={statusColors[rec.status ?? ""] || "secondary"}
                              className="text-[9px] font-black"
                            >
                              {statusLabels[rec.status ?? ""] || rec.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-[10px] font-bold text-muted tabular-nums">
                            {new Date(String(rec.created_at || "")).toLocaleString("ar-EG", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                (rec.stats?.lateMinutes ?? 0) > 0
                                  ? "danger"
                                  : "success"
                              }
                              className="text-[9px] font-black"
                            >
                              {(rec.stats?.lateMinutes ?? 0) > 0
                                ? `متأخر ${rec.stats?.lateMinutes ?? 0}د`
                                : "طبيعي"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </motion.div>
  );
}
