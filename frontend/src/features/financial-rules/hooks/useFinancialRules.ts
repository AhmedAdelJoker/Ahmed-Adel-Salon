import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import api from "@/services/api";
import { formatCurrency as formatCurrencyShared } from "@/lib/core/utils";

const DEFAULT_FINANCIAL_RULES = {
  cashierDiscountLimit: 50,
  requireDiscountReason: true,
  requireManagerApprovalAboveLimit: true,
  requireOpenShiftForInvoices: true,
  lockInvoicesAfterShiftClose: true,
  allowNegativeInventory: false,
  enableProductCostTracking: true,
  enableExpenseApproval: true,
  maxCashDiscrepancyWithoutNote: 0,
  taxRate: 14,
  maxInvoiceWithoutApproval: 5000,
  enableSuspiciousDiscountAlerts: true,
  autoLockShiftHours: 24,
  shiftAutoCloseGracePeriod: 30,
  shiftCloseWarningMinutes: 15,
  enableAutoShiftClose: true,
  defaultPaymentMethod: "cash",
  enabledPaymentMethods: {
    cash: true,
    card: true,
    wallet: true,
    instapay: true,
  },
};

const FINANCIAL_RULES_STORAGE_KEY = "financial.rules.settings";

const DEFAULT_FINANCIAL_SYNC_STATUS = {
  rulesSource: "local",
  invoicesAvailable: true,
  expensesAvailable: true,
  shiftsAvailable: true,
  auditAvailable: true,
  lastMessage: "",
};

export const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  card: "فيزا / شبكة",
  wallet: "محفظة كاش",
  instapay: "إنستا باي",
  mada: "مدى",
};

type AnyRecord = Record<string, any>;

function asArray(response: unknown): AnyRecord[] {
  const data = (response as { data?: unknown } | null)?.data ?? response;
  if (Array.isArray(data)) return data as AnyRecord[];
  if (Array.isArray((data as AnyRecord)?.items)) return (data as AnyRecord).items as AnyRecord[];
  if (Array.isArray((data as AnyRecord)?.data)) return (data as AnyRecord).data as AnyRecord[];
  return [];
}

export function formatCurrency(value: number) {
  return formatCurrencyShared(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "---";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    return String(value);
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFinancialRules(input = {}) {
  const merged = {
    ...DEFAULT_FINANCIAL_RULES,
    ...(input && typeof input === "object" ? input : {}),
  };

  return {
    ...merged,
    taxRate: Math.max(
      0,
      Number(merged.taxRate ?? DEFAULT_FINANCIAL_RULES.taxRate) || 0,
    ),
    cashierDiscountLimit: Math.max(
      0,
      Number(
        merged.cashierDiscountLimit ??
          DEFAULT_FINANCIAL_RULES.cashierDiscountLimit,
      ) || 0,
    ),
    maxCashDiscrepancyWithoutNote: Math.max(
      0,
      Number(
        merged.maxCashDiscrepancyWithoutNote ??
          DEFAULT_FINANCIAL_RULES.maxCashDiscrepancyWithoutNote,
      ) || 0,
    ),
    maxInvoiceWithoutApproval: Math.max(
      0,
      Number(
        merged.maxInvoiceWithoutApproval ??
          DEFAULT_FINANCIAL_RULES.maxInvoiceWithoutApproval,
      ) || 0,
    ),
    autoLockShiftHours: Math.max(
      0,
      Number(
        merged.autoLockShiftHours ?? DEFAULT_FINANCIAL_RULES.autoLockShiftHours,
      ) || 0,
    ),
    shiftAutoCloseGracePeriod: Math.max(
      0,
      Number(
        merged.shiftAutoCloseGracePeriod ??
          DEFAULT_FINANCIAL_RULES.shiftAutoCloseGracePeriod,
      ) || 0,
    ),
    shiftCloseWarningMinutes: Math.max(
      0,
      Number(
        merged.shiftCloseWarningMinutes ??
          DEFAULT_FINANCIAL_RULES.shiftCloseWarningMinutes,
      ) || 0,
    ),
    enabledPaymentMethods: {
      ...DEFAULT_FINANCIAL_RULES.enabledPaymentMethods,
      ...(merged.enabledPaymentMethods || {}),
    },
  };
}

function readStoredFinancialRules() {
  try {
    const raw = localStorage.getItem(FINANCIAL_RULES_STORAGE_KEY);
    return raw
      ? sanitizeFinancialRules(JSON.parse(raw))
      : sanitizeFinancialRules(DEFAULT_FINANCIAL_RULES);
  } catch (err) {
    return sanitizeFinancialRules(DEFAULT_FINANCIAL_RULES);
  }
}

interface CapturedSuccess {
  ok: true;
  response: any;
}

interface CapturedFailure {
  ok: false;
  error: { response?: { status?: number; data?: unknown } };
}

async function captureRequest(request: Promise<unknown>): Promise<CapturedSuccess | CapturedFailure> {
  try {
    const response = await request;
    return { ok: true, response };
  } catch (error) {
    return {
      ok: false,
      error: error as CapturedFailure["error"],
    };
  }
}

export default function useFinancialRules() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [rules, setRules] = useState(() => readStoredFinancialRules());
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);
  const [expenses, setExpenses] = useState<AnyRecord[]>([]);
  const [shifts, setShifts] = useState<AnyRecord[]>([]);
  const [auditRows, setAuditRows] = useState<AnyRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [syncStatus, setSyncStatus] = useState(DEFAULT_FINANCIAL_SYNC_STATUS);

  async function loadData({ background = false } = {}) {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);

      const [settingsRes, invoicesRes, expensesRes, shiftsRes, auditRes] =
        await Promise.all([
          captureRequest(api.get("/financial-rules")),
          captureRequest(api.get("/invoices", { params: { limit: 50 } })),
          captureRequest(api.get("/expenses", { params: { limit: 50 } })),
          captureRequest(api.get("/pos-shifts", { params: { limit: 20 } })),
          captureRequest(
            api.get("/activity-logs", {
              params: {
                page: 1,
                page_size: 30,
                q: "invoice discount expense shift payment",
              },
            }),
          ),
        ]);

      if (settingsRes.ok && typeof settingsRes.response?.data === "object") {
        const sanitized = sanitizeFinancialRules(settingsRes.response.data);
        setRules(sanitized);
        localStorage.setItem(
          FINANCIAL_RULES_STORAGE_KEY,
          JSON.stringify(sanitized),
        );
      }

      setInvoices(invoicesRes.ok ? asArray(invoicesRes.response) : []);
      setExpenses(expensesRes.ok ? asArray(expensesRes.response) : []);
      setShifts(shiftsRes.ok ? asArray(shiftsRes.response) : []);
      setAuditRows(auditRes.ok ? asArray(auditRes.response) : []);

      let lastMessage = "";
      if (!settingsRes.ok) {
        lastMessage =
          settingsRes.error?.response?.status === 404
            ? "القواعد المالية تُعرض من النسخة المحلية مؤقتًا حتى يكتمل النظام أو يعاد تشغيل الخادم."
            : "تعذر الوصول إلى خادم القواعد المالية، لذلك يتم استخدام آخر نسخة محلية محفوظة.";
      } else if (
        !invoicesRes.ok ||
        !expensesRes.ok ||
        !shiftsRes.ok ||
        !auditRes.ok
      ) {
        lastMessage =
          "تم تحميل مركز القواعد المالية جزئيًا، لكن بعض بيانات الفواتير أو المصروفات أو الرقابة لم تصل من الخادم.";
      }

      setSyncStatus({
        rulesSource: settingsRes.ok ? "server" : "local",
        invoicesAvailable: invoicesRes.ok,
        expensesAvailable: expensesRes.ok,
        shiftsAvailable: shiftsRes.ok,
        auditAvailable: auditRes.ok,
        lastMessage,
      });
    } catch (error) {
      console.error("Financial rules load error:", error);
      toast.error("تعذر تحميل القواعد المالية");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const today = todayKey();
    const todayInvoices = invoices.filter(
      (invoice) =>
        String(invoice.created_at || invoice.createdAt || "").slice(0, 10) ===
        today,
    );
    const todayExpenses = expenses.filter(
      (expense) =>
        String(
          expense.created_at || expense.createdAt || expense.date || "",
        ).slice(0, 10) === today,
    );

    const revenue = todayInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.total_amount ?? invoice.totalAmount ?? 0),
      0,
    );
    const expenseTotal = todayExpenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount ?? expense.total_amount ?? 0),
      0,
    );
    const discounts = todayInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.discount_amount ?? invoice.discountAmount ?? 0),
      0,
    );
    const openShifts = shifts.filter((shift) =>
      ["open", "opened", "OPEN", "OPENED"].includes(String(shift.status || "")),
    ).length;

    return {
      revenue,
      expenseTotal,
      net: revenue - expenseTotal,
      discounts,
      openShifts,
    };
  }, [invoices, expenses, shifts]);

  const filteredAuditRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = auditRows.filter((row) =>
      /invoice|discount|expense|shift|payment|refund|cash/i.test(
        `${row.action || ""} ${row.entity_type || ""} ${row.description || ""}`,
      ),
    );
    if (!query) return rows;
    return rows.filter((row) =>
      `${row.action || ""} ${row.entity_type || ""} ${row.description || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [auditRows, searchTerm]);

  function updateRule(key: string, value: any) {
    setRules((previous) => ({ ...previous, [key]: value }));
  }

  function updatePaymentMethod(key: string, value: boolean) {
    setRules((previous) => ({
      ...previous,
      enabledPaymentMethods: {
        ...(previous.enabledPaymentMethods || {}),
        [key]: value,
      },
    }));
  }

  async function saveRules() {
    try {
      setSaving(true);
      const sanitizedRules = sanitizeFinancialRules(rules);
      setRules(sanitizedRules);
      await api.put("/financial-rules", sanitizedRules);
      try {
        await api.put("/business-settings", {
          shift_auto_close_grace_period:
            sanitizedRules.shiftAutoCloseGracePeriod,
        });
      } catch (bsErr) {
        console.error(
          "Failed to sync shift grace period to business settings:",
          bsErr,
        );
      }
      localStorage.setItem(
        FINANCIAL_RULES_STORAGE_KEY,
        JSON.stringify(sanitizedRules),
      );
      setSyncStatus((current) => ({
        ...current,
        rulesSource: "server",
        lastMessage: "",
      }));
      toast.success("تم حفظ القواعد المالية بنجاح");
    } catch (error) {
      console.error("Financial rules save error:", error);
      const sanitizedRules = sanitizeFinancialRules(rules);
      localStorage.setItem(
        FINANCIAL_RULES_STORAGE_KEY,
        JSON.stringify(sanitizedRules),
      );
      setSyncStatus((current) => ({
        ...current,
        rulesSource: "local",
        lastMessage:
          "تعذر الحفظ على الخادم، لذلك تم الاحتفاظ بالتعديلات محليًا حتى تعود المزامنة.",
      }));
      toast.error("تم الاحتفاظ بالقيم محليًا للعمل بها أوفلاين مؤقتاً.");
    } finally {
      setSaving(false);
    }
  }

  async function exportRules() {
    try {
      const response = await api.get("/exports/financial-rules", {
        responseType: "blob",
      });
      const file = new globalThis.Blob([response.data], {
        type: (response.headers?.["content-type"] as string | undefined) || "application/octet-stream",
      });
      const url = globalThis.URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `financial_rules_${todayKey()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(url);
      toast.success("تم تصدير تقرير القواعد المالية");
    } catch (error) {
      console.error("Financial rules export error:", error);
      toast.error("تعذر تصدير تقرير القواعد المالية");
    }
  }

  return {
    loading,
    saving,
    refreshing,
    activeTab,
    setActiveTab,
    rules,
    searchTerm,
    setSearchTerm,
    syncStatus,
    metrics,
    filteredAuditRows,
    updateRule,
    updatePaymentMethod,
    saveRules,
    exportRules,
    loadData,
  };
}
