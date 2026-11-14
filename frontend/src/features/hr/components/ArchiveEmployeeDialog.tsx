import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Archive, CalendarClock, LogOut, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARCHIVE_REASON_VALUES,
  FIELD_LABEL_CLASS,
} from "@/features/hr/utils/constants";
import { archiveReasonLabel } from "@/features/hr/utils/helpers";
import { cn } from "@/lib/core/utils";
import type { ArchiveForm, EmployeeArchiveImpact } from "@/features/hr/types";

/** The "none chosen" option, which is a real answer: nobody recorded why. */
const NO_REASON = "none";

/**
 * The archive decision, with what it touches next to it.
 *
 * Archiving used to be a yes/no dialog. It is not a yes/no decision: the
 * person may hold bookings that have not happened yet, may have a login that
 * stays usable unless it is closed, and leaves behind a record that reads
 * "resigned" with no date or reason unless this dialog collects them. So the
 * consequences are shown before the button, not in a toast after it.
 */
export default function ArchiveEmployeeDialog({
  open,
  onOpenChange,
  targetName,
  impact,
  form,
  setForm,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetName?: string;
  impact: EmployeeArchiveImpact | null;
  form: ArchiveForm;
  setForm: (form: ArchiveForm) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation("owner");
  const navigate = useNavigate();

  const rows = [
    impact && impact.futureAppointments > 0
      ? {
          icon: CalendarClock,
          tone: "text-warning",
          text: t("hr.impactAppointments", { count: impact.futureAppointments }),
        }
      : null,
    impact && impact.hasLoginAccount
      ? { icon: LogOut, tone: "text-danger", text: t("hr.impactLoginClosed") }
      : null,
    impact
      ? {
          icon: ShieldCheck,
          tone: "text-content-tertiary",
          text: t("hr.impactVisibilityKept"),
        }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof Archive; tone: string; text: string }>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border-line bg-raised p-0">
        <DialogHeader className="gap-2 px-6 pt-6">
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-danger-line bg-danger-bg text-danger">
            <Archive size={20} />
          </div>
          <DialogTitle className="text-lg font-semibold text-content">
            {t("hr.archiveTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium leading-relaxed text-content-secondary">
            {t("hr.archiveDesc", { name: targetName ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {rows.length > 0 && (
          <ul className="mx-6 mt-4 space-y-2 rounded-xl border border-line bg-sunken p-3">
            {rows.map((row) => (
              <li key={row.text} className="flex items-start gap-2 text-xs font-medium text-content-secondary">
                <row.icon size={14} className={cn("mt-0.5 shrink-0", row.tone)} />
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-4 px-6 pt-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="archive-last-day" className={FIELD_LABEL_CLASS}>
              {t("hr.archiveLastDay")}
            </label>
            <Input
              id="archive-last-day"
              type="date"
              value={form.effectiveDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
              className="h-10 rounded-lg border-line bg-sunken text-sm font-semibold text-content focus:border-accent focus:bg-raised"
              dir="ltr"
            />
            <p className="text-[10px] font-medium text-content-tertiary">
              {t("hr.archiveLastDayHint")}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className={FIELD_LABEL_CLASS}>{t("hr.archiveReason")}</span>
            <Select
              value={form.reason || NO_REASON}
              onValueChange={(v) =>
                setForm({ ...form, reason: v === NO_REASON ? "" : v })
              }
            >
              <SelectTrigger
                id="archive-reason"
                className="h-10 rounded-lg border-line bg-sunken text-sm font-semibold text-content"
              >
                <SelectValue placeholder={t("hr.archiveReasonPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REASON}>{t("hr.archiveReasonNone")}</SelectItem>
                {ARCHIVE_REASON_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {archiveReasonLabel(value, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] font-medium text-content-tertiary">
              {t("hr.archiveReasonHint")}
            </p>
          </div>
        </div>

        {impact && impact.futureAppointments > 0 && (
          <button
            type="button"
            onClick={() => navigate("/bookings")}
            className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-warning-line bg-warning-bg px-3 py-2 text-start text-xs font-semibold text-warning-content transition-colors hover:bg-warning-bg/70"
          >
            <AlertTriangle size={14} className="shrink-0" />
            {t("hr.impactOpenBookings")}
          </button>
        )}

        <DialogFooter className="gap-2 px-6 pb-6 pt-5 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-lg font-semibold"
          >
            {t("hr.cancel")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-danger font-semibold text-content-inverse hover:bg-danger/90"
          >
            <Archive size={15} className="ms-1.5" />
            {loading ? t("hr.submitting") : t("hr.archiveConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
