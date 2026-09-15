import { PAYMENT_LABELS } from "@/features/financial-reports/constants";

export function shortLabel(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

export function paymentLabel(key: string): string {
  if (!key) return "غير محدد";
  const k = String(key).trim().toLowerCase();
  return PAYMENT_LABELS[k] ?? String(key);
}

export function dayKeyOf(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : "";
}

export function compactTick(v: number): string {
  const n = Number(v);
  const num = Number.isFinite(n) ? n : 0;
  if (Math.abs(num) >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(num));
}
