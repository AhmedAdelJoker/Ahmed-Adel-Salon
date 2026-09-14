/**
 * Pure financial-analytics helpers for the owner Financial Reports page.
 * Kept side-effect free (except downloadCsvFile) so they are unit-testable.
 */
import { formatCurrency } from "@/lib/core/utils";
import type { TrendPoint } from "@/types/reports";

export interface DayAnomaly {
  date: string;
  label: string;
  kind: "rev_spike" | "exp_spike" | "net_drop";
  message: string;
  severity: "high" | "medium";
}

export interface MonthlyBucket {
  key: string;
  label: string;
  rev: number;
  exp: number;
  net: number;
}

/** % change vs baseline, or null when there is no baseline to compare against. */
export function pctGrowth(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev) || prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

/** Mean + population std-dev for a numeric series. */
export function meanStd(values: number[]): { mean: number; std: number } {
  if (!values.length) return { mean: 0, std: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Flag statistically unusual days: revenue spikes, expense spikes (incl. 3x
 * median rule), and deep net drops. Pure client-side, no backend needed.
 */
export function detectAnomalies(trends: TrendPoint[]): DayAnomaly[] {
  if (trends.length < 4) return [];
  const revs = trends.map((t) => t.rev);
  const exps = trends.map((t) => t.exp);
  const nets = trends.map((t) => t.net);
  const r = meanStd(revs);
  const e = meanStd(exps);
  const n = meanStd(nets);
  const sortedExp = [...exps].sort((a, b) => a - b);
  const medianExp = sortedExp[Math.floor(sortedExp.length / 2)] || 0;
  const out: DayAnomaly[] = [];
  trends.forEach((t) => {
    if (r.std > 0 && t.rev >= r.mean + 2 * r.std && t.rev > 0) {
      out.push({
        date: t.date,
        label: t.label,
        kind: "rev_spike",
        message: `قفزة إيرادات يوم ${t.date} (${formatCurrency(t.rev)}) أعلى بكثير من المتوسط ${formatCurrency(r.mean)}`,
        severity: t.rev >= r.mean + 3 * r.std ? "high" : "medium",
      });
    }
    const expSpike =
      (e.std > 0 && t.exp >= e.mean + 2 * e.std && t.exp > 0) ||
      (medianExp > 0 && t.exp >= medianExp * 3);
    if (expSpike) {
      out.push({
        date: t.date,
        label: t.label,
        kind: "exp_spike",
        message: `قفزة مصروفات يوم ${t.date} (${formatCurrency(t.exp)}) مقابل متوسط ${formatCurrency(e.mean)} — راجع بنود ذلك اليوم`,
        severity: medianExp > 0 && t.exp >= medianExp * 3 ? "high" : "medium",
      });
    }
    if (n.std > 0 && t.net <= n.mean - 2 * n.std) {
      out.push({
        date: t.date,
        label: t.label,
        kind: "net_drop",
        message: `هبوط حاد بالصافي يوم ${t.date} (${formatCurrency(t.net)}) — افحص الإيراد والمصروف معاً`,
        severity: "medium",
      });
    }
  });
  const rank = { high: 0, medium: 1 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6);
}

/** Client-side CSV download (BOM for Arabic Excel compatibility). No backend needed. */
export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const escape = (v: string | number): string => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = `\uFEFF${headers.map(escape).join(",")}\n${rows.map((r) => r.map(escape).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function monthKeyOf(iso: string): string {
  return iso.length >= 7 ? iso.slice(0, 7) : "";
}

export function monthLabelAr(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  if (!y || !(idx >= 0 && idx < 12)) return key;
  return `${AR_MONTHS[idx]} ${y}`;
}

/** Last N month keys (YYYY-MM) ending at the current month, ascending. */
export function lastNMonthKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
