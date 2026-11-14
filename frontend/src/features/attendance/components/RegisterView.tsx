import { useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  Fingerprint,
  Info,
  Loader2,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmployeeRecord } from "@/features/attendance/types";
import { cn } from "@/lib/core/utils";
import { type TranslateFn } from "@/features/attendance/utils/attendance";

function localNowInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function RegisterView({
  employees,
  onRefresh,
  t,
}: {
  employees: EmployeeRecord[];
  onRefresh: () => Promise<void> | void;
  t: TranslateFn;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [statusType, setStatusType] = useState("in");
  const [timestamp, setTimestamp] = useState(localNowInput());
  const [lateReason, setLateReason] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [fpEmployeeId, setFpEmployeeId] = useState("");
  const [fpType, setFpType] = useState<"check-in" | "check-out">("check-in");
  const [fpTime, setFpTime] = useState(localNowInput());
  const [fpLateReason, setFpLateReason] = useState("");
  const [isFp, setIsFp] = useState(false);

  const [isImporting, setIsImporting] = useState<"" | "excel" | "biometric">(
    "",
  );
  const [importResult, setImportResult] = useState<string | null>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLInputElement>(null);

  const employeeOptions = useMemo(
    () =>
      [...(employees || [])].sort((a, b) =>
        String(a.full_name || a.name || "").localeCompare(
          String(b.full_name || b.name || ""),
          "ar",
        ),
      ),
    [employees],
  );

  const detail = (err: unknown) => {
    const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
    const d = e?.response?.data?.detail;
    if (typeof d === "string") return d;
    return e?.message || t("attendance.registerFailed");
  };

  const handleManualRegister = async () => {
    if (!employeeId) return toast.error(t("attendance.selectEmployee"));
    setIsRegistering(true);
    try {
      await api.post("/barber-presence/register", null, {
        params: {
          employee_id: employeeId,
          status_type: statusType,
          timestamp,
          ...(lateReason.trim() ? { late_reason: lateReason.trim() } : {}),
        },
      });
      toast.success(t("attendance.registerSuccess"));
      setLateReason("");
      await onRefresh();
    } catch (err) {
      toast.error(detail(err));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFingerprint = async () => {
    if (!fpEmployeeId) return toast.error(t("attendance.selectEmployee"));
    setIsFp(true);
    try {
      // The old call posted a JSON body {employee_id, punch_type, timestamp} to
      // /attendance/fingerprint, but that endpoint only reads query params
      // named `type` — every UI fingerprint attempt failed with 422. The
      // fingerprint card now records through the same register endpoint and
      // state machine as the manual card, so duplicate punches and late
      // arrivals are guarded identically.
      await api.post("/barber-presence/register", null, {
        params: {
          employee_id: fpEmployeeId,
          status_type: fpType === "check-in" ? "in" : "out",
          timestamp: fpTime,
          ...(fpLateReason.trim() ? { late_reason: fpLateReason.trim() } : {}),
        },
      });
      toast.success(t("attendance.fingerprintSuccess"));
      setFpLateReason("");
      await onRefresh();
    } catch (err) {
      toast.error(detail(err));
    } finally {
      setIsFp(false);
    }
  };

  const handleUpload = async (file: File | null, type: "excel" | "biometric") => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setIsImporting(type);
    setImportResult(null);
    const endpoint =
      type === "excel"
        ? "/barber-presence/import-excel"
        : "/barber-presence/import-biometric";
    try {
      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const msg =
        res.data?.message ||
        (typeof res.data?.imported === "number"
          ? `${t("attendance.importSuccess")} (${res.data.imported})`
          : t("attendance.importSuccess"));
      setImportResult(msg);
      toast.success(t("attendance.importSuccess"));
      await onRefresh();
    } catch (err) {
      const msg = detail(err);
      setImportResult(msg);
      toast.error(t("attendance.importFailed"));
    } finally {
      setIsImporting("");
      if (excelRef.current) excelRef.current.value = "";
      if (bioRef.current) bioRef.current.value = "";
    }
  };

  const EmployeeSelect = ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (v: string) => void;
    id: string;
  }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-11 rounded-xl">
        <SelectValue placeholder={t("attendance.selectEmployeeLabel")} />
      </SelectTrigger>
      <SelectContent>
        {employeeOptions.map((emp) => (
          <SelectItem key={emp.id} value={String(emp.id)}>
            {emp.full_name || emp.name || `#${emp.id}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4" id="attendance-panel-register" role="tabpanel">
      <div className="rounded-2xl border border-sky-500/15 bg-sky-500/5 p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-sky-700" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-main">{t("attendance.realDataOnly")}</p>
            <p className="mt-1 text-xs font-medium text-muted">
              {t("attendance.templateColumnsBody")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-main">{t("attendance.registerTitle")}</h3>
              <p className="mt-1 text-xs font-medium text-muted">{t("attendance.registerHint")}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="reg-emp" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.employee")}
              </label>
              <EmployeeSelect id="reg-emp" value={employeeId} onChange={setEmployeeId} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-type" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.operationType")}
                </label>
                <Select value={statusType} onValueChange={setStatusType}>
                  <SelectTrigger id="reg-type" className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">{t("attendance.statusIn")}</SelectItem>
                    <SelectItem value="out">{t("attendance.statusOut")}</SelectItem>
                    <SelectItem value="break">{t("attendance.statusBreak")}</SelectItem>
                    <SelectItem value="break_end">{t("attendance.statusBreakEnd")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="reg-time" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.timestamp")}
                </label>
                <Input
                  id="reg-time"
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label htmlFor="reg-late" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.lateReason")}
              </label>
              <Input
                id="reg-late"
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder={t("attendance.lateReasonPlaceholder")}
                className="h-11 rounded-xl"
              />
            </div>
            <Button
              className="h-11 w-full rounded-xl font-bold"
              onClick={handleManualRegister}
              disabled={isRegistering}
            >
              {isRegistering ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>{isRegistering ? t("attendance.submitting") : t("attendance.submitRegister")}</span>
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700">
              <Fingerprint size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-main">{t("attendance.fingerprintTitle")}</h3>
              <p className="mt-1 text-xs font-medium text-muted">{t("attendance.fingerprintHint")}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="fp-emp" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.employee")}
              </label>
              <EmployeeSelect id="fp-emp" value={fpEmployeeId} onChange={setFpEmployeeId} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="fp-type" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.operationType")}
                </label>
                <Select value={fpType} onValueChange={(v) => setFpType(v as any)}>
                  <SelectTrigger id="fp-type" className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check-in">{t("attendance.statusIn")}</SelectItem>
                    <SelectItem value="check-out">{t("attendance.statusOut")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="fp-time" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.timestamp")}
                </label>
                <Input
                  id="fp-time"
                  type="datetime-local"
                  value={fpTime}
                  onChange={(e) => setFpTime(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label htmlFor="fp-late" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.lateReason")}
              </label>
              <Input
                id="fp-late"
                value={fpLateReason}
                onChange={(e) => setFpLateReason(e.target.value)}
                placeholder={t("attendance.lateReasonPlaceholder")}
                className="h-11 rounded-xl"
              />
            </div>
            <Button
              variant="secondary"
              className="h-11 w-full rounded-xl font-bold"
              onClick={handleFingerprint}
              disabled={isFp}
            >
              {isFp ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
              <span>{isFp ? t("attendance.submitting") : t("attendance.fingerprintSubmit")}</span>
            </Button>
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-main">{t("attendance.importTitle")}</h4>
                <p className="mt-1 text-xs font-medium text-muted">{t("attendance.importHint")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <input
                  ref={excelRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files?.[0] || null, "excel")}
                />
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl font-bold"
                  disabled={!!isImporting}
                  onClick={() => excelRef.current?.click()}
                >
                  {isImporting === "excel" ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  <span>{t("attendance.importExcel")}</span>
                </Button>
              </div>
              <div>
                <input
                  ref={bioRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files?.[0] || null, "biometric")}
                />
                <Button
                  variant="outline"
                  className={cn("h-11 w-full rounded-xl font-bold")}
                  disabled={!!isImporting}
                  onClick={() => bioRef.current?.click()}
                >
                  {isImporting === "biometric" ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                  <span>{t("attendance.importBiometric")}</span>
                </Button>
              </div>
            </div>
            {importResult && (
              <div className="mt-3 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs font-semibold text-main">
                {importResult}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
