import type { CashboxSummary, Transaction } from "@/types/cashbox";

export const TYPE_LABELS: Record<string, string> = {
  invoice_payment: "تحصيل فاتورة",
  expense_payment: "دفع مصروف",
  manual_deposit: "إيداع يدوي",
  manual_withdraw: "سحب يدوي",
  opening_balance: "رصيد افتتاحي",
  closing_balance: "رصيد إغلاق",
  refund: "استرداد",
  payroll_payment: "صرف راتب",
  salary_advance: "سلفة",
};

export const TYPE_COLORS: Record<string, string> = {
  manual_deposit: "#10b981",
  invoice_payment: "#6366f1",
  manual_withdraw: "#ef4444",
  expense_payment: "#f59e0b",
  refund: "#06b6d4",
  payroll_payment: "#8b5cf6",
  salary_advance: "#f97316",
  opening_balance: "#0ea5e9",
  closing_balance: "#475569",
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
  wallet: "محفظة",
};

export function isVoided(row: Transaction): boolean {
  const v = (row as unknown as { is_voided?: unknown }).is_voided;
  return Number(v ?? 0) === 1 || v === true;
}

export function getTypeLabel(type?: string | null): string {
  if (!type) return "غير محدد";
  return TYPE_LABELS[type] ?? type;
}

export function getTypeColor(type?: string | null, idx = 0): string {
  if (type && TYPE_COLORS[type]) return TYPE_COLORS[type];
  return `hsl(${(idx * 47) % 360} 70% 50%)`;
}

export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatDateTimeLocal(value?: string | null): string {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function escapeCsvCell(value: unknown): string {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildCashboxCsv(rows: Transaction[]): string {
  const headers = ["رقم العملية", "التاريخ", "الاتجاه", "النوع", "المبلغ", "طريقة الدفع", "المرجع", "الملاحظات", "الرصيد بعد", "الحالة"];
  const lines = rows.map((r) =>
    [
      escapeCsvCell(r.transaction_no ?? `#${r.id}`),
      escapeCsvCell(formatDateTimeLocal(r.transaction_date ?? r.created_at)),
      escapeCsvCell(r.direction === "in" ? "وارد" : "صادر"),
      escapeCsvCell(getTypeLabel(r.type)),
      escapeCsvCell(r.amount),
      escapeCsvCell(PAYMENT_LABELS[String(r.payment_method ?? "cash")] ?? String(r.payment_method ?? "")),
      escapeCsvCell(r.reference_no ?? ""),
      escapeCsvCell((r.notes ?? "").replace(/\r?\n/g, " ")),
      escapeCsvCell(r.balance_after ?? ""),
      escapeCsvCell(isVoided(r) ? "ملغاة" : "معتمدة"),
    ].join(","),
  );
  return ["\uFEFF" + headers.join(","), ...lines].join("\n");
}

export function emptySummary(): CashboxSummary {
  return {
    total_in: 0,
    total_out: 0,
    cash_balance: 0,
    today_sales: 0,
    today_expenses: 0,
    today_net: 0,
    cash_in: 0,
    cash_out: 0,
    cash_balance_detail: 0,
    non_cash_in: 0,
    non_cash_out: 0,
    non_cash_balance: 0,
    cash_today_sales: 0,
    cash_today_expenses: 0,
    cash_today_net: 0,
    non_cash_today_sales: 0,
    non_cash_today_expenses: 0,
    non_cash_today_net: 0,
    drawer_balance: 0,
    drawer_open_shifts: 0,
    by_payment_method: {},
    period_label: "الكل",
    period_start: null,
    period_end: null,
    period_in: 0,
    period_out: 0,
    period_net: 0,
    period_cash_in: 0,
    period_cash_out: 0,
    period_cash_net: 0,
    period_non_cash_in: 0,
    period_non_cash_out: 0,
    period_non_cash_net: 0,
  };
}

export type VaultPeriod = "all" | "day" | "week" | "month" | "year" | "custom";

export function getPeriodRange(period: VaultPeriod, from: string, to: string): { start: string | null; end: string | null } {
  if (period === "custom") return { start: from || null, end: to || null };
  if (period === "all") return { start: null, end: null };
  // الباقي يحسب في الباك، الفرونت يرسل period فقط
  return { start: null, end: null };
}

export function isCashPayment(pm?: string | null): boolean {
  return String(pm ?? "cash").toLowerCase() === "cash";
}

export function getPaymentMethodMeta(pm?: string | null): { label: string; color: string; bg: string } {
  const key = String(pm ?? "cash").toLowerCase();
  const map: Record<string, { label: string; color: string; bg: string }> = {
    cash: { label: "نقدي", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    card: { label: "شبكة", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
    bank_transfer: { label: "تحويل بنكي", color: "text-sky-700", bg: "bg-sky-50 border-sky-200" },
    wallet: { label: "محفظة", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  };
  return map[key] ?? { label: key, color: "text-muted", bg: "bg-soft border-border" };
}

export function getRoleMeta(role?: string | null): { label: string; color: string; bg: string } {
  const r = String(role ?? "").toLowerCase();
  if (["owner", "admin"].includes(r)) return { label: "مالك", color: "text-slate-900", bg: "bg-slate-900 text-white" };
  if (r === "manager") return { label: "مدير", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200 text-indigo-700" };
  if (r === "accountant") return { label: "محاسب", color: "text-amber-700", bg: "bg-amber-50 border-amber-200 text-amber-700" };
  if (r === "cashier") return { label: "كاشير", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200 text-emerald-700" };
  if (r === "barber") return { label: "حلاق", color: "text-sky-700", bg: "bg-sky-50 border-sky-200 text-sky-700" };
  return { label: role || "مستخدم", color: "text-muted", bg: "bg-soft border-border text-muted" };
}

export function getCreator(tx: Transaction): { name: string; role?: string | null; avatar?: string | null } {
  const u = tx.created_by_user ?? tx.user;
  if (u) {
    const name = (u.full_name || u.username || "مستخدم") as string;
    return { name, role: u.role ?? null, avatar: u.profile_image_url ?? null };
  }
  return { name: "النظام", role: null, avatar: null };
}

export function parseRecipientNotes(notes?: string | null): { cleanNotes: string; recipient?: string; reference?: string } {
  if (!notes) return { cleanNotes: "" };
  let clean = notes;
  let recipient: string | undefined;
  let reference: string | undefined;
  const recMatch = notes.match(/المستفيد:\s*([^\n]+)/);
  if (recMatch) {
    recipient = recMatch[1].trim();
    clean = clean.replace(recMatch[0], "").trim();
  }
  const refMatch = notes.match(/المرجع:\s*([^\n]+)/);
  if (refMatch) {
    reference = refMatch[1].trim();
    clean = clean.replace(refMatch[0], "").trim();
  }
  clean = clean.replace(/\n{2,}/g, "\n").trim();
  return { cleanNotes: clean, recipient, reference };
}

export function getLinkedEntity(tx: Transaction): { label: string; href?: string } | null {
  const t = String(tx.reference_type ?? "").toLowerCase();
  const id = tx.reference_id;
  const no = tx.reference_no;
  if (t === "invoice" && id) return { label: `فاتورة ${no || `#${id}`}`, href: `/invoices` };
  if (t === "expense" && id) return { label: `مصروف ${no || `#${id}`}`, href: `/expenses` };
  if (t === "payroll" && id) return { label: `راتب #${id}`, href: `/owner/payroll` };
  if (t === "pos_shift" && id) return { label: `وردية #${id}`, href: `/pos` };
  if (t === "manual" || !t) return null;
  if (no) return { label: `${t} ${no}` };
  if (id) return { label: `${t} #${id}` };
  return null;
}
