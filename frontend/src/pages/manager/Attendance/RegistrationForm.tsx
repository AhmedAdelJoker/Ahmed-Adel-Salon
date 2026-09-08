import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Clock,
  FileText,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";

const statusOptions = [
  { value: "in", label: "تسجيل حضور" },
  { value: "out", label: "تسجيل انصراف" },
  { value: "break", label: "بدء استراحة" },
  { value: "break_end", label: "نهاية الاستراحة" },
];

const LATE_THRESHOLD_MINUTES = 15;

export interface DayWorkingHours {
  is_open?: boolean;
  open_time?: string;
  close_time?: string;
  [key: string]: unknown;
}

export interface TodayRecord {
  id?: string | number;
  employee_name?: string;
  full_name?: string;
  stats?: {
    lateMinutes?: number;
    [key: string]: unknown;
  };
  late_reason?: string;
  [key: string]: unknown;
}

export interface RegistrationFormProps {
  regEmployeeId?: string;
  setRegEmployeeId?: (id: string) => void;
  regStatus?: string;
  setRegStatus?: (status: string) => void;
  regTime?: string;
  setRegTime?: (time: string) => void;
  employees?: { id?: string | number; full_name?: string; [key: string]: unknown }[];
  regPreview?: boolean;
  isRegistering?: boolean;
  setShowRegConfirm?: (show: boolean) => void;
  todayRecords?: TodayRecord[]; // Add todayRecords to check existing logs
}

const RegistrationForm = ({
  regEmployeeId,
  setRegEmployeeId,
  regStatus,
  setRegStatus,
  regTime,
  setRegTime,
  employees,
  regPreview,
  isRegistering,
  setShowRegConfirm,
  todayRecords, // Add todayRecords to check existing logs
}: RegistrationFormProps) => {
  const [workingHours, setWorkingHours] = useState<Record<string, DayWorkingHours> | null>(null);
  const [isLate, setIsLate] = useState(false);
  const [expectedTime, setExpectedTime] = useState<string | null>(null);
  const [lateReason, setLateReason] = useState("");
  const [existingLateRecord, setExistingLateRecord] = useState<TodayRecord | null>(null);

  useEffect(() => {
    api
      .get("/barber-presence/working-hours")
      .then((res) => {
        setWorkingHours(res.data?.working_hours || {});
      })
      .catch(() => {});
  }, []);

  // Check if employee already has a late record today without reason
  useEffect(() => {
    if (!regEmployeeId || !todayRecords) {
      setExistingLateRecord(null);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const empRecord = todayRecords.find(
      (r) =>
        String(r.id) === String(regEmployeeId) &&
        (r.stats?.lateMinutes ?? 0) > 0 &&
        !r.late_reason,
    );
    setExistingLateRecord(empRecord || null);
  }, [regEmployeeId, todayRecords]);

  useEffect(() => {
    if (!regTime || regStatus !== "in") {
      setIsLate(false);
      setExpectedTime(null);
      return;
    }
    const selected = new Date(regTime);
    const dayName = selected
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();
    const dayConfig = workingHours?.[dayName];

    if (!dayConfig?.is_open || !dayConfig?.open_time) {
      setIsLate(false);
      setExpectedTime(null);
      return;
    }

    const [openH, openM] = dayConfig.open_time.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const selectedMinutes = selected.getHours() * 60 + selected.getMinutes();

    if (selectedMinutes > openMinutes + LATE_THRESHOLD_MINUTES) {
      setIsLate(true);
      setExpectedTime(dayConfig.open_time);
    } else {
      setIsLate(false);
      setExpectedTime(null);
    }
  }, [regTime, regStatus, workingHours]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => setRegTime?.(e.target.value);

  return (
    <div className="space-y-4">
      {/* Working Hours Info */}
      {workingHours && (
        <div className="rounded-xl bg-info/5 border border-info/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={12} className="text-info" />
            <span className="text-[9px] font-black uppercase tracking-wider text-info">
              مواعيد العمل
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px] font-bold text-muted">
            {Object.entries(workingHours)
              .slice(0, 4)
              .map(([day, config]) => (
                <span key={day} className="truncate">
                  {day}:{" "}
                  {config.is_open
                    ? `${config.open_time || "--"} - ${config.close_time || "--"}`
                    : "مغلق"}
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted">
          الموظف المعني
        </label>
        <Select value={regEmployeeId} onValueChange={(v) => setRegEmployeeId?.(v)}>
          <SelectTrigger className="h-11 w-full rounded-xl font-bold">
            <SelectValue placeholder="اختر الموظف..." />
          </SelectTrigger>
          <SelectContent>
            {employees?.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted">
          نوع العملية
        </label>
        <Select value={regStatus} onValueChange={(v) => setRegStatus?.(v)}>
          <SelectTrigger className="h-11 w-full rounded-xl font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted">
          توقيت القيد
        </label>
        <Input
          type="datetime-local"
          value={regTime}
          onChange={handleTimeChange}
          className="h-11 w-full rounded-xl font-bold"
        />
      </div>

      {/* Late Reason Form for existing late records */}
      <AnimatePresence>
        {existingLateRecord && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl bg-warning/5 border border-warning/20 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-warning" />
              <span className="text-[10px] font-black text-warning">
                يوجد تسجيل متأخر بدون سبب!
              </span>
            </div>
            <p className="text-[9px] font-bold text-muted">
              الموظف:{" "}
              {existingLateRecord.employee_name || existingLateRecord.full_name}{" "}
              - تأخير: {existingLateRecord.stats?.lateMinutes} دقيقة
            </p>
            <textarea
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="اكتب سبب التأخير لهذا الموظف..."
              className="w-full h-16 rounded-lg border border-warning/30 bg-card p-2 text-xs font-bold resize-none focus:border-warning focus:ring-0"
            />
            <Button
              onClick={async () => {
                try {
                  await api.post(
                    `/barber-presence/${existingLateRecord.id}/late-reason`,
                    { reason: lateReason },
                  );
                  toast.success("تم حفظ سبب التأخير");
                  setLateReason("");
                } catch (err) {
                  const apiErr = err as { response?: { data?: { detail?: unknown } } };
                  toast.error((apiErr?.response?.data?.detail as string) || "فشل الحفظ");
                }
              }}
              disabled={!lateReason.trim() || isRegistering}
              className="w-full h-10 rounded-xl font-black text-xs"
            >
              <FileText size={14} className="ml-1.5" /> حفظ سبب التأخير
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Late Warning for new registration */}
      <AnimatePresence>
        {isLate && !existingLateRecord && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl bg-danger/5 border border-danger/20 p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-danger" />
              <span className="text-[10px] font-black text-danger">
                تسجيل متأخر!
              </span>
            </div>
            <p className="text-[9px] font-bold text-muted">
              موعد العمل: {expectedTime}. يرجى كتابة سبب التأخير:
            </p>
            <textarea
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="اكتب سبب التأخير..."
              className="w-full h-16 rounded-lg border border-danger/30 bg-card p-2 text-xs font-bold resize-none focus:border-danger focus:ring-0"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview */}
      <AnimatePresence>
        {regPreview && !isLate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-success/20 bg-success/5 p-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-success" />
              <span className="text-[10px] font-black text-success">
                التسجيل في الموعد
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setShowRegConfirm?.(true)}
        disabled={
          isRegistering || !regEmployeeId || (isLate && !lateReason.trim())
        }
        loading={isRegistering}
        className="h-11 w-full rounded-xl font-black text-xs"
      >
        <Plus size={16} className="ml-1.5" /> اعتماد القيد
      </Button>
    </div>
  );
};

export default RegistrationForm;
