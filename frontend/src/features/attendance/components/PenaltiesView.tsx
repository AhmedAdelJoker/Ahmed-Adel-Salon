import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, BadgeX, Receipt, Loader2, RefreshCw, Plus, Lock, ShieldCheck, CalendarClock, Pencil } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatDateTime,
  type TranslateFn,
} from "@/features/attendance/utils/attendance";
import { formatEmployeeMoney } from "@/features/hr/utils/helpers";
import { cn } from "@/lib/core/utils";

export interface PenaltyRow {
  id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  late_minutes: number;
  reason: string | null;
  penalty_amount: number;
  is_excused: boolean;
  source: "auto" | "manual" | string;
  locked?: boolean;
  created_at: string | null;
}

interface PenaltyEmployeeOption {
  id?: number | string;
  full_name?: string;
  name?: string;
}

export default function PenaltiesView({
  t,
  locale,
  language,
  employees = [],
}: {
  t: TranslateFn;
  locale: string;
  language?: string;
  employees?: PenaltyEmployeeOption[];
}) {
  const [startDate, setStartDate] = useState(
    () =>
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [rows, setRows] = useState<PenaltyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"open" | "archive">("open");
  const monthBounds = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const first = new Date(y, m, 1).toISOString().split("T")[0];
    const last = new Date(y, m + 1, 0).toISOString().split("T")[0];
    const prevLast = new Date(y, m, 0).toISOString().split("T")[0];
    // scope=open → current month bounds; archive → never past last day of previous month.
    return { first, last, prevLast };
  }, []);
  const [viewMode, setViewMode] = useState<"daily" | "weekly" | "monthly">("daily");

  // Waiver gate — the 4-digit PIN is configured in attendance settings.
  // The server refuses waivers while it is missing, and month closures in
  // the archive freeze the month entirely.
  const [pinConfigured, setPinConfigured] = useState(false);
  const [lockedMonths, setLockedMonths] = useState<string[]>([]);
  const [waiveTarget, setWaiveTarget] = useState<PenaltyRow | null>(null);
  const [waiverPin, setWaiverPin] = useState("");
  const [isWaiving, setIsWaiving] = useState(false);
  const [isComputingAbsence, setIsComputingAbsence] = useState(false);
  const [editTarget, setEditTarget] = useState<PenaltyRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPin, setEditPin] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { user } = useAuth();
  const isManagement = ["owner", "admin", "manager"].includes(
    String(user?.role || "").toLowerCase(),
  );
  const absenceMonth = useMemo(
    () => (endDate || new Date().toISOString().split("T")[0]).slice(0, 7),
    [endDate],
  );

  // Manual-add dialog state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addMinutes, setAddMinutes] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addReason, setAddReason] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchGate = useCallback(async () => {
    try {
      const res = await api.get("/barber-presence/penalty-months");
      setPinConfigured(Boolean(res.data?.pin_configured));
      setLockedMonths(Array.isArray(res.data?.locked_months) ? res.data.locked_months : []);
    } catch {
      setPinConfigured(false);
      setLockedMonths([]);
    }
  }, []);

  useEffect(() => {
    void fetchGate();
  }, [fetchGate]);

  const fetchPenalties = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/barber-presence/penalties", {
        params: {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          scope: scope === "archive" ? "archive" : "open",
        },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRows([]);
      toast.error(t("attendance.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, t]);

  useEffect(() => {
    void fetchPenalties();
  }, [fetchPenalties]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          count: acc.count + 1,
          amount: acc.amount + (row.is_excused ? 0 : Number(row.penalty_amount || 0)),
          waived: acc.waived + (row.is_excused ? 1 : 0),
        }),
        { count: 0, amount: 0, waived: 0 },
      ),
    [rows],
  );

  // Weekly / monthly rollups from the same rows. ISO-week bucketing keeps the
  // grouping stable across locale boundaries; monthly grouping uses YYYY-MM.
  const rollups = useMemo(() => {
    if (viewMode === "daily") return [] as Array<{
      key: string;
      label: string;
      count: number;
      amount: number;
      excused: number;
      late_minutes: number;
    }>;

    const buckets = new Map<string, typeof rows>();
    for (const row of rows) {
      const d = new Date(row.date);
      let key: string;
      if (viewMode === "weekly") {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        key = `W:${monday.toISOString().split("T")[0]}`;
      } else {
        key = `M:${row.date.slice(0, 7)}`;
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(row);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => {
        const label = key.slice(2);
        const amount = group.reduce((a, r) => a + (r.is_excused ? 0 : Number(r.penalty_amount || 0)), 0);
        const late_minutes = group.reduce((a, r) => a + Number(r.late_minutes || 0), 0);
        return {
          key,
          label,
          count: group.length,
          amount,
          excused: group.filter((r) => r.is_excused).length,
          late_minutes,
        };
      });
  }, [rows, viewMode]);

  const resetAddForm = () => {
    setAddEmployeeId("");
    setAddDate(new Date().toISOString().split("T")[0]);
    setAddMinutes("");
    setAddAmount("");
    setAddReason("");
  };

  const handleAddPenalty = async () => {
    if (!addEmployeeId) return toast.error(t("attendance.selectEmployee"));
    if (addReason.trim().length < 2) return toast.error(t("attendance.penaltyReasonRequired"));

    const minutes = addMinutes === "" ? undefined : Number(addMinutes);
    const amount = addAmount === "" ? undefined : Number(addAmount);
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0)) {
      return toast.error(t("attendance.penaltyInvalidMinutes"));
    }
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      return toast.error(t("attendance.penaltyInvalidAmount"));
    }
    if (minutes === undefined && amount === undefined) {
      return toast.error(t("attendance.penaltyAmountOrMinutes"));
    }

    setIsAdding(true);
    try {
      await api.post("/barber-presence/penalties", {
        employee_id: Number(addEmployeeId),
        date: addDate || undefined,
        late_minutes: minutes,
        penalty_amount: amount,
        reason: addReason.trim(),
      });
      toast.success(t("attendance.penaltyCreated"));
      setShowAddForm(false);
      resetAddForm();
      await fetchPenalties();
    } catch (err) {
      const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = typeof e?.response?.data?.detail === "string" ? e.response.data.detail : e?.message;
      toast.error(detail || t("attendance.addPenaltyFailed"));
    } finally {
      setIsAdding(false);
    }
  };

  const monthOf = (row: PenaltyRow) => row.date?.slice(0, 7) ?? "";
  const rowLocked = (row: PenaltyRow) =>
    scope === "archive" || Boolean(row.locked) || lockedMonths.includes(monthOf(row));

  // Waives are irreversible by design: one PIN, one action, no undo.
  const handleConfirmWaive = async () => {
    if (!waiveTarget || isWaiving || waiverPin.length !== 4) return;
    setIsWaiving(true);
    try {
      await api.patch(`/barber-presence/penalties/${waiveTarget.id}`, {
        is_excused: true,
        pin: waiverPin,
      });
      setRows((prev) =>
        prev.map((r) => (r.id === waiveTarget.id ? { ...r, is_excused: true } : r)),
      );
      toast.success(t("attendance.penaltyWaivedPermanently"));
      setWaiveTarget(null);
      setWaiverPin("");
    } catch (err) {
      const e = err as { response?: { data?: { detail?: unknown } } };
      const detail = e?.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : t("attendance.penaltyWaiveFailed"),
      );
    } finally {
      setIsWaiving(false);
    }
  };

  const handleComputeAbsence = async () => {
    if (isComputingAbsence) return;
    setIsComputingAbsence(true);
    try {
      const res = await api.post("/barber-presence/penalties/compute-absence", {
        month: absenceMonth,
      });
      const created = Number(res.data?.created ?? 0);
      toast.success(
        created > 0
          ? t("attendance.absencesComputed", { count: created })
          : t("attendance.absencesComputedNone", { month: absenceMonth }),
      );
      await fetchPenalties();
    } catch (err) {
      const e = err as { response?: { data?: { detail?: unknown } } };
      const detail = e?.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : t("attendance.absencesComputedFailed"),
      );
    } finally {
      setIsComputingAbsence(false);
    }
  };

  const handleConfirmEditAmount = async () => {
    if (!editTarget || isSavingEdit) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
      return toast.error(t("attendance.penaltyInvalidAmount"));
    }
    if (editPin.length !== 4) {
      return toast.error(t("attendance.penaltyPinInvalid"));
    }
    setIsSavingEdit(true);
    try {
      const res = await api.patch(`/barber-presence/penalties/${editTarget.id}`, {
        amount,
        pin: editPin,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === editTarget.id
            ? { ...r, penalty_amount: Number(res.data?.penalty_amount ?? amount) }
            : r,
        ),
      );
      toast.success(t("attendance.penaltyAmountUpdated"));
      setEditTarget(null);
      setEditAmount("");
      setEditPin("");
    } catch (err) {
      const e = err as { response?: { data?: { detail?: unknown } } };
      const detail = e?.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : t("attendance.penaltyEditFailed"),
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div
      className="space-y-4"
      id="attendance-panel-penalties"
      role="tabpanel"
      aria-labelledby="attendance-tab-penalties"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-main">
            <Receipt size={18} className="text-primary" /> {t("attendance.penaltiesTitle")}
          </h3>
          <p className="mt-1 text-xs font-medium text-muted">{t("attendance.penaltiesHint")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* نطاق العرض: الحالية أو الأرشيف */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card/70 p-1 text-[11px] font-black" role="tablist" aria-label={t("attendance.penaltiesScopeLabel")}>
            {(["open", "archive"] as const).map((s) => {
              const active = scope === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setScope(s);
                    // Snap dates into the picked scope's valid window.
                    if (s === "archive") {
                      const pm = new Date(monthBounds.prevLast);
                      pm.setDate(1);
                      setStartDate(pm.toISOString().split("T")[0]);
                      setEndDate(monthBounds.prevLast);
                    } else {
                      setStartDate(monthBounds.first);
                      setEndDate(new Date().toISOString().split("T")[0]);
                    }
                  }}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-lg px-3 transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted hover:bg-soft hover:text-main",
                  )}
                >
                  {s === "open" ? t("attendance.penaltiesScopeOpen") : t("attendance.penaltiesScopeArchive")}
                </button>
              );
            })}
          </div>
          {/* العرض: يومي / أسبوعي / شهري */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card/70 p-1 text-[11px] font-black" role="tablist" aria-label={t("attendance.penaltiesViewLabel")}>
            {(["daily", "weekly", "monthly"] as const).map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "h-9 rounded-lg px-3 transition-colors",
                    active ? "bg-card text-main shadow-sm" : "text-muted hover:text-main",
                  )}
                >
                  {mode === "daily"
                    ? t("attendance.penaltiesViewDaily")
                    : mode === "weekly"
                    ? t("attendance.penaltiesViewWeekly")
                    : t("attendance.penaltiesViewMonthly")}
                </button>
              );
            })}
          </div>
          {scope === "open" && isManagement && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-xl"
              onClick={() => void handleComputeAbsence()}
              disabled={isComputingAbsence}
              title={t("attendance.absencesComputeTitle", { month: absenceMonth })}
            >
              {isComputingAbsence ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
              <span>{t("attendance.absencesCompute")}</span>
            </Button>
          )}
          {scope === "open" && (
            <Button size="sm" className="h-10 gap-2 rounded-xl" onClick={() => setShowAddForm(true)}>
              <Plus size={16} />
              <span>{t("attendance.addPenalty")}</span>
            </Button>
          )}
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 w-auto rounded-xl" aria-label={t("attendance.from")} max={scope === "open" ? monthBounds.last : monthBounds.prevLast} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 w-auto rounded-xl" aria-label={t("attendance.to")} max={scope === "open" ? new Date().toISOString().split("T")[0] : monthBounds.prevLast} />
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void fetchPenalties()} aria-label={t("attendance.refresh")}>
            <RefreshCw size={16} className={cn(loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Lock banners: pin missing / months frozen by archive closure */}
      {!pinConfigured && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-900">
          <Lock size={14} className="shrink-0" />
          {t("attendance.pinNotConfigured")}
        </div>
      )}
      {scope === "archive" && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-900">
          <Lock size={14} className="shrink-0" />
          {t("attendance.penaltiesArchiveHint")}
        </div>
      )}

      {lockedMonths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-900">
          <Lock size={14} className="shrink-0" />
          <span>{t("attendance.lockedMonthsHint")}</span>
          {lockedMonths.map((m) => (
            <span key={m} className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px]">{m}</span>
          ))}
        </div>
      )}

      {/* View rollups for weekly / monthly modes */}
      {viewMode !== "daily" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {rollups.length === 0 ? (
            <div className="py-10 text-center text-xs font-bold text-muted">
              {t("attendance.penaltiesEmpty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] font-black uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 text-start">{t(viewMode === "weekly" ? "attendance.rollupWeek" : "attendance.rollupMonth")}</th>
                    <th className="px-3 py-2 text-start">{t("attendance.kpiPenaltyCount")}</th>
                    <th className="px-3 py-2 text-start">{t("attendance.lateMinutes")}</th>
                    <th className="px-3 py-2 text-start">{t("attendance.penaltyAmount")}</th>
                    <th className="px-3 py-2 text-start">{t("attendance.rollupWaived")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rollups.map((r) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 font-mono text-xs font-black text-main">{r.label}</td>
                      <td className="px-3 py-2 tabular-nums font-bold text-main">{r.count}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">{r.late_minutes}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums text-danger">{formatEmployeeMoney(r.amount, locale, language)}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">
                        {r.excused > 0 ? <span className="text-success">{r.excused}</span> : "0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: t("attendance.kpiPenaltyCount"), value: String(totals.count) },
          {
            label: t("attendance.kpiPenaltyTotal"),
            value: formatEmployeeMoney(totals.amount, locale, language),
          },
          { label: t("attendance.kpiPenaltyWaived"), value: String(totals.waived) },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-muted/10 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-muted">{kpi.label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-main">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/20 text-muted">
              <Receipt size={24} />
            </div>
            <p className="mt-4 text-sm font-black text-main">{t("attendance.penaltiesEmpty")}</p>
            <p className="mt-1 max-w-sm text-xs font-medium text-muted">{t("attendance.penaltiesEmptyHint")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("attendance.colEmployee")}</TableHead>
                <TableHead>{t("attendance.colDateTime")}</TableHead>
                <TableHead>{t("attendance.lateMinutes")}</TableHead>
                <TableHead>{t("attendance.colSource")}</TableHead>
                <TableHead>{t("attendance.reason")}</TableHead>
                <TableHead>{t("attendance.colPenalty")}</TableHead>
                <TableHead>{t("attendance.colStatus")}</TableHead>
                <TableHead className="text-end">{t("attendance.colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={cn(row.is_excused && "opacity-60")}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar name={row.employee_name} size="xs" shape="circle" />
                      <span className="font-bold text-main">{row.employee_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <div className="flex items-center gap-1.5">
                      {rowLocked(row) && <Lock size={12} className="text-amber-700" aria-label={t("attendance.monthLocked")} />}
                      {formatDateTime(row.date, locale, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.late_minutes}</TableCell>
                  <TableCell>
                    <Badge variant={row.source === "manual" ? "default" : "secondary"}>
                      {row.source === "manual"
                        ? t("attendance.sourceManual")
                        : t("attendance.sourceAuto")}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate" title={row.reason || undefined}>
                    {row.reason || "—"}
                  </TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatEmployeeMoney(row.penalty_amount, locale, language)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.is_excused ? "secondary" : "danger"} className="gap-1">
                      {row.is_excused ? <BadgeCheck size={12} /> : <BadgeX size={12} />}
                      {row.is_excused ? t("attendance.waived") : t("attendance.applied")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {row.is_excused ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                        <ShieldCheck size={12} /> {t("attendance.waivedPermanent")}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {isManagement && !rowLocked(row) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(row);
                              setEditAmount(String(row.penalty_amount ?? ""));
                              setEditPin("");
                            }}
                            title={t("attendance.editPenaltyAmount")}
                            aria-label={t("attendance.editPenaltyAmount")}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:border-accent hover:text-accent"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl text-xs font-bold"
                          disabled={rowLocked(row)}
                          title={rowLocked(row) ? t("attendance.monthLocked") : undefined}
                          onClick={() => {
                            setWaiveTarget(row);
                            setWaiverPin("");
                          }}
                        >
                          {rowLocked(row) ? <Lock size={12} /> : null}
                          {t("attendance.waivePenalty")}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Waiver confirmation — one-way door, PIN-gated */}
      <Dialog open={waiveTarget != null} onOpenChange={(open) => { if (!open) { setWaiveTarget(null); setWaiverPin(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-danger">{t("attendance.waiveTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-danger-soft bg-danger-soft p-3 text-xs font-medium text-danger">
              {t("attendance.waiveWarning", { amount: waiveTarget ? formatEmployeeMoney(waiveTarget.penalty_amount, locale, language) : "" })}
            </div>
            {!pinConfigured ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-bold text-amber-900">
                {t("attendance.pinNotConfigured")}
              </div>
            ) : (
              <div>
                <label htmlFor="waive-pin" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.penaltyPinLabel")}
                </label>
                <Input
                  id="waive-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  autoFocus
                  value={waiverPin}
                  onChange={(e) => setWaiverPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  onKeyDown={(e) => { if (e.key === "Enter" && waiverPin.length === 4) void handleConfirmWaive(); }}
                  className="h-12 rounded-xl text-center text-xl tracking-[0.6em]"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => { setWaiveTarget(null); setWaiverPin(""); }}>
                {t("attendance.cancel")}
              </Button>
              <Button
                variant="danger"
                className="h-11 flex-1 rounded-xl font-black"
                disabled={!pinConfigured || waiverPin.length !== 4 || isWaiving}
                onClick={() => void handleConfirmWaive()}
              >
                {isWaiving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                <span>{isWaiving ? t("attendance.submitting") : t("attendance.waiveConfirm")}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit-amount dialog: PATCH with PIN, audit-logged, management-only */}
      <Dialog open={editTarget != null} onOpenChange={(open) => { if (!open) { setEditTarget(null); setEditAmount(""); setEditPin(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{t("attendance.editPenaltyAmountTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/10 p-3 text-xs font-medium text-muted">
              {t("attendance.editPenaltyAmountHint", { amount: editTarget ? formatEmployeeMoney(editTarget.penalty_amount, locale, language) : "" })}
            </div>
            <div>
              <label htmlFor="edit-amount" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.penaltyAmount")}
              </label>
              <Input
                id="edit-amount"
                type="number"
                min={0}
                max={100000}
                step="0.5"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="h-12 rounded-xl font-black tabular-nums"
              />
            </div>
            {!pinConfigured ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-bold text-amber-900">
                {t("attendance.pinNotConfigured")}
              </div>
            ) : (
              <div>
                <label htmlFor="edit-pin" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.penaltyPinLabel")}
                </label>
                <Input
                  id="edit-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  autoFocus
                  value={editPin}
                  onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  onKeyDown={(e) => { if (e.key === "Enter" && editPin.length === 4) void handleConfirmEditAmount(); }}
                  className="h-12 rounded-xl text-center text-xl tracking-[0.6em]"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => { setEditTarget(null); setEditAmount(""); setEditPin(""); }}>
                {t("attendance.cancel")}
              </Button>
              <Button
                className="h-11 flex-1 rounded-xl"
                disabled={!pinConfigured || editPin.length !== 4 || isSavingEdit || editAmount.trim() === ""}
                onClick={() => void handleConfirmEditAmount()}
              >
                {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                <span>{isSavingEdit ? t("attendance.submitting") : t("attendance.save")}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">{t("attendance.addPenaltyTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="pn-emp" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.employee")}
              </label>
              <Select value={addEmployeeId} onValueChange={setAddEmployeeId}>
                <SelectTrigger id="pn-emp" className="h-11 rounded-xl">
                  <SelectValue placeholder={t("attendance.selectEmployeeLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((emp) => emp.id != null)
                    .map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.full_name || emp.name || `#${emp.id}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pn-date" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.colDateTime")}
                </label>
                <Input id="pn-date" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div>
                <label htmlFor="pn-minutes" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                  {t("attendance.penaltyMinutes")}
                </label>
                <Input id="pn-minutes" type="number" min={0} max={1440} placeholder="0" value={addMinutes} onChange={(e) => setAddMinutes(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            <div>
              <label htmlFor="pn-amount" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.penaltyAmount")}
              </label>
              <Input id="pn-amount" type="number" min={0} step="0.5" placeholder={t("attendance.penaltyAmountPlaceholder")} value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className="h-11 rounded-xl" />
              <p className="mt-1 text-[11px] font-medium text-muted">{t("attendance.penaltyAmountHint")}</p>
            </div>
            <div>
              <label htmlFor="pn-reason" className="mb-1 block text-[11px] font-black uppercase tracking-wide text-muted">
                {t("attendance.reason")} <span className="text-danger">*</span>
              </label>
              <Input id="pn-reason" value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder={t("attendance.penaltyReasonPlaceholder")} className="h-11 rounded-xl" autoFocus />
            </div>
            {lockedMonths.includes(addDate.slice(0, 7)) && (
              <p className="text-[11px] font-bold text-amber-800">{t("attendance.addPenaltyLockedMonth")}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setShowAddForm(false)}>
                {t("attendance.cancel")}
              </Button>
              <Button
                className="h-11 flex-1 rounded-xl"
                onClick={() => void handleAddPenalty()}
                disabled={isAdding || lockedMonths.includes(addDate.slice(0, 7))}
              >
                {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>{isAdding ? t("attendance.submitting") : t("attendance.addPenalty")}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
