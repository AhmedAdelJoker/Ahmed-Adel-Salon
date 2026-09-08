import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  BadgePercent,
  Banknote,
  Calculator,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileCheck2,
  FileLock2,
  Landmark,
  Lock,
  Percent,
  Receipt,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
  XCircle,
  Sparkles,
  Zap,
  BellRing,
  Settings2,
} from "lucide-react";
import { motion } from "framer-motion";

import api from "@/services/api";
import { Button } from "@/components/ui/button";
import {
  StatCard,
} from "@/components/shared/PremiumUI";
import InlineNotice from "@/components/shared/InlineNotice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency as formatCurrencyShared } from "@/lib/core/utils";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence } from "framer-motion";

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

const paymentLabels = {
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

function formatCurrency(value) {
  return formatCurrencyShared(value);
}

function formatDate(value) {
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

export default function FinancialRules() {
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

  function updateRule(key, value) {
    setRules((previous) => ({ ...previous, [key]: value }));
  }

  function updatePaymentMethod(key, value) {
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
      // Also sync shift auto-close settings to the business_settings table.
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

  const tabs = [
    { id: "overview", label: "نظرة عامة والملخص", icon: TrendingUp },
    { id: "rules", label: "قواعد الفواتير والضرائب", icon: Receipt },
    { id: "payments", label: "المدفوعات والورديات", icon: Wallet },
    { id: "audit", label: "سجل الرقابة المالية", icon: FileLock2 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Calculator className="h-12 w-12 animate-pulse" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            جاري مزامنة البروتوكول المالي...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 animate-fade-in" dir="rtl">
      {/* Premium Dashboard Header */}
      <div className="relative overflow-hidden rounded-[32px] bg-zinc-950 text-white p-8 lg:p-10 shadow-2xl shadow-black/20 border border-white/5">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[100px] -mr-[200px] -mt-[200px] opacity-60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] -ml-[200px] -mb-[200px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
          <div className="flex items-center gap-6 max-w-2xl">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 border border-emerald-400/30">
              <Landmark size={32} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-3 backdrop-blur-md">
                <Sparkles size={12} className="text-emerald-400" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-100">
                  إدارة اقتصاديات المؤسسة
                </span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-2 leading-tight">
                مركز{" "}
                <span className="bg-gradient-to-l from-white to-white/40 bg-clip-text text-transparent">
                  القواعد المالية
                </span>
              </h1>
              <p className="text-sm text-white/50 leading-relaxed font-medium max-w-xl">
                هيكل متقدم للتحكم في الضرائب، سياسات الخصم، طرق الدفع، ومعايير
                فتح وإغلاق الورديات لضمان أقصى درجات الرقابة.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0 mt-6 lg:mt-0">
            <Button
              onClick={() => loadData({ background: true })}
              disabled={refreshing}
              className="h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all backdrop-blur-md"
            >
              <RefreshCw
                size={16}
                className={cn("ml-2", refreshing && "animate-spin")}
              />{" "}
              مزامنة
            </Button>
            <Button
              onClick={exportRules}
              className="h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all backdrop-blur-md"
            >
              <Download size={16} className="ml-2" /> تصدير السجل
            </Button>
            <Button
              onClick={saveRules}
              disabled={saving}
              className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)] hover:scale-[1.02]"
            >
              <Save size={16} className="ml-2" /> توثيق القواعد
            </Button>
          </div>
        </div>
      </div>

      {syncStatus.lastMessage ? (
        <InlineNotice
          tone={syncStatus.rulesSource === "local" ? "warning" : "info"}
          className="rounded-2xl border-border/50 shadow-sm"
        >
          {syncStatus.lastMessage}
        </InlineNotice>
      ) : null}

      {/* Main Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition-all whitespace-nowrap border",
                isActive
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md"
                  : "bg-card text-muted-foreground border-border/60 hover:bg-soft",
              )}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents with Framer Motion */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <OverviewPanel rules={rules} metrics={metrics} />
          )}
          {activeTab === "rules" && (
            <RulesPanel rules={rules} updateRule={updateRule} />
          )}
          {activeTab === "payments" && (
            <PaymentsPanel
              rules={rules}
              updateRule={updateRule}
              updatePaymentMethod={updatePaymentMethod}
            />
          )}
          {activeTab === "audit" && (
            <AuditPanel
              rows={filteredAuditRows}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function OverviewPanel({ rules, metrics }) {
  const checks = [
    { title: "الضرائب مفعّلة (VAT)", value: rules.taxRate > 0, icon: Percent },
    {
      title: "تنبيهات الخصم المشبوه",
      value: rules.enableSuspiciousDiscountAlerts,
      icon: BellRing,
    },
    {
      title: "سبب الخصم إلزامي",
      value: rules.requireDiscountReason,
      icon: BadgePercent,
    },
    {
      title: "موافقة المدير للخصومات",
      value: rules.requireManagerApprovalAboveLimit,
      icon: ShieldAlert,
    },
    {
      title: "البيع مرتبط بالوردية",
      value: rules.requireOpenShiftForInvoices,
      icon: Lock,
    },
    {
      title: "قفل فواتير الوردية المغلقة",
      value: rules.lockInvoicesAfterShiftClose,
      icon: FileLock2,
    },
    {
      title: "اعتماد المصروفات",
      value: rules.enableExpenseApproval,
      icon: FileCheck2,
    },
    {
      title: "منع المخزون السالب",
      value: !rules.allowNegativeInventory,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Financial Metrics Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="إيرادات اليوم"
          value={formatCurrency(metrics.revenue)}
          icon={Banknote}
          variant="success"
        />
        <StatCard
          label="مصروفات اليوم"
          value={formatCurrency(metrics.expenseTotal)}
          icon={CreditCard}
          variant="warning"
        />
        <StatCard
          label="صافي اليوم"
          value={formatCurrency(metrics.net)}
          icon={TrendingUp}
          variant={metrics.net >= 0 ? "primary" : "danger"}
        />
        <StatCard
          label="إجمالي الخصومات"
          value={formatCurrency(metrics.discounts)}
          icon={BadgePercent}
          variant="secondary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-[32px] border-border/50 bg-card shadow-sm lg:col-span-2 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-soft flex items-center justify-center text-main shadow-inner">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-main leading-tight">
                    حالة الحماية الرقابية
                  </h2>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    مدى صرامة القواعد المطبقة بالنظام
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 border-emerald-200 text-emerald-600 font-black px-4 py-1"
              >
                موثق ومفعل
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {checks.map((check, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-2xl bg-soft/40 border border-border/40 hover:bg-soft transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shadow-sm",
                        check.value
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-red-100 text-red-600",
                      )}
                    >
                      <check.icon size={16} />
                    </div>
                    <span className="text-sm font-bold text-main">
                      {check.title}
                    </span>
                  </div>
                  {check.value ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <XCircle size={18} className="text-red-500" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-border/50 bg-card shadow-sm overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-xl bg-soft flex items-center justify-center text-main shadow-inner">
                <Zap size={24} />
              </div>
              <h2 className="text-xl font-black text-main leading-tight">
                ملخص الحركة المباشرة
              </h2>
            </div>

            <div className="space-y-4">
              <SummaryLine
                label="الإيراد المسجل"
                value={formatCurrency(metrics.revenue)}
              />
              <SummaryLine
                label="المنصرف"
                value={formatCurrency(metrics.expenseTotal)}
              />
              <div className="my-4 border-t border-dashed border-border/60" />
              <SummaryLine
                label="الصافي الحالي"
                value={formatCurrency(metrics.net)}
                highlight={metrics.net >= 0 ? "success" : "danger"}
                large
              />
              <div className="mt-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800">
                  الورديات المفتوحة (درج النقود)
                </span>
                <span className="text-lg font-black text-blue-600">
                  {metrics.openShifts}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RulesPanel({ rules, updateRule }) {
  const booleanRules = [
    {
      key: "enableSuspiciousDiscountAlerts",
      title: "تنبيهات الخصم المشبوه",
      description: "إصدار تنبيه للمالك عند تجاوز الخصومات لمعدلات غير طبيعية.",
      icon: BellRing,
    },
    {
      key: "requireDiscountReason",
      title: "إلزام سبب الخصم",
      description:
        "لا يسمح بإضافة أي خصم على الفاتورة بدون كتابة ملاحظة توضيحية.",
      icon: BadgePercent,
    },
    {
      key: "requireManagerApprovalAboveLimit",
      title: "اعتماد الخصومات العالية",
      description:
        "المطالبة بموافقة مدير/مالك عند تجاوز نسبة الخصم حد الكاشير المسموح.",
      icon: ShieldAlert,
    },
    {
      key: "enableExpenseApproval",
      title: "اعتماد المصروفات",
      description:
        "لا يتم إدراج المصروفات الكبيرة بالتقارير إلا بعد مراجعتها واعتمادها.",
      icon: FileCheck2,
    },
    {
      key: "enableProductCostTracking",
      title: "تتبع تكلفة المخزون",
      description:
        "احتساب الربحية تلقائياً بناءً على متوسط تكلفة الشراء للمنتج.",
      icon: Calculator,
    },
    {
      key: "allowNegativeInventory",
      title: "السماح بالمخزون السالب",
      description: "تمكين بيع منتجات رصيدها صفر. (لا يُنصح به لأسباب رقابية).",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="rounded-[32px] border-border/50 bg-card shadow-sm lg:col-span-2 p-8">
        <h2 className="text-xl font-black text-main mb-6 flex items-center gap-3">
          <Receipt className="text-muted-foreground" size={24} /> سياسات
          الفواتير والخصم
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {booleanRules.map((rule) => (
            <ToggleRule
              key={rule.key}
              rule={rule}
              rules={rules}
              updateRule={updateRule}
            />
          ))}
        </div>
      </Card>

      <Card className="rounded-[32px] border-border/50 bg-card shadow-sm p-8">
        <h2 className="text-xl font-black text-main mb-6 flex items-center gap-3">
          <Calculator className="text-muted-foreground" size={24} /> القيم
          والحدود المالية
        </h2>
        <div className="space-y-6">
          <NumberField
            label="نسبة الضريبة (VAT) %"
            value={rules.taxRate}
            onChange={(value) => updateRule("taxRate", value)}
            icon={Percent}
          />
          <NumberField
            label="حد خصم الكاشير (%)"
            value={rules.cashierDiscountLimit}
            onChange={(value) => updateRule("cashierDiscountLimit", value)}
            icon={BadgePercent}
            max={100}
          />
          <NumberField
            label="أقصى قيمة للفاتورة بدون اعتماد (ج.م)"
            value={rules.maxInvoiceWithoutApproval}
            onChange={(value) => updateRule("maxInvoiceWithoutApproval", value)}
            icon={Banknote}
          />
        </div>
      </Card>
    </div>
  );
}

function PaymentsPanel({ rules, updateRule, updatePaymentMethod }) {
  const methods = ["cash", "card", "wallet", "instapay"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="rounded-[32px] border-border/50 bg-card shadow-sm lg:col-span-2 p-8">
        <h2 className="text-xl font-black text-main mb-6 flex items-center gap-3">
          <Lock className="text-muted-foreground" size={24} /> ضوابط درج النقود
          والورديات
        </h2>

        <div className="space-y-4 mb-8">
          <ToggleRule
            rule={{
              key: "requireOpenShiftForInvoices",
              title: "الربط بنقاط البيع المفتوحة",
              description:
                "يُمنع أي مستخدم من إصدار فواتير دون فتح وردية/درج نقود خاص به.",
              icon: Lock,
            }}
            rules={rules}
            updateRule={updateRule}
            layout="row"
          />
          <ToggleRule
            rule={{
              key: "lockInvoicesAfterShiftClose",
              title: "تجميد الفواتير للورديات المغلقة",
              description:
                "تحويل فواتير الوردية المغلقة لوضع القراءة فقط (تتطلب مدير للتعديل).",
              icon: FileLock2,
            }}
            rules={rules}
            updateRule={updateRule}
            layout="row"
          />
        </div>

        <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
          قنوات الدفع المسموحة للعملاء
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {methods.map((method) => (
            <div
              key={method}
              className="flex items-center justify-between p-4 rounded-2xl bg-soft/50 border border-border/50 hover:bg-soft transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-card border border-border/50 flex items-center justify-center text-main shadow-sm">
                  {method === "cash" ? (
                    <Banknote size={18} />
                  ) : method === "card" ? (
                    <CreditCard size={18} />
                  ) : (
                    <Wallet size={18} />
                  )}
                </div>
                <span className="font-bold text-sm text-main">
                  {paymentLabels[method]}
                </span>
              </div>
              <Switch
                checked={Boolean(rules.enabledPaymentMethods?.[method])}
                onCheckedChange={(checked) =>
                  updatePaymentMethod(method, checked)
                }
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-[32px] border-border/50 bg-card shadow-sm p-8">
          <h2 className="text-xl font-black text-main mb-6 flex items-center gap-3">
            <CheckCircle2 className="text-muted-foreground" size={24} /> التفضيل
            الافتراضي للدفع
          </h2>
          <div className="space-y-3">
            {methods.map((method) => (
              <button
                key={method}
                onClick={() => updateRule("defaultPaymentMethod", method)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-sm font-bold text-right",
                  rules.defaultPaymentMethod === method
                    ? "border-accent bg-accent/5 text-accent shadow-sm"
                    : "border-border/50 bg-soft/30 text-muted-foreground hover:bg-soft hover:text-main",
                )}
              >
                <span>{paymentLabels[method]}</span>
                {rules.defaultPaymentMethod === method && (
                  <CheckCircle2 size={18} />
                )}
              </button>
            ))}
          </div>
        </Card>

        <Card className="rounded-[32px] border-border/50 bg-card shadow-sm p-8">
          <h2 className="text-xl font-black text-main mb-6 flex items-center gap-3">
            <Settings2 className="text-muted-foreground" size={24} /> إعدادات
            الإغلاق التلقائي للورديات
          </h2>

          <div className="space-y-5">
            <ToggleRule
              rule={{
                key: "enableAutoShiftClose",
                title: "الإغلاق التلقائي للورديات",
                description:
                  "يقوم النظام تلقائياً بإغلاق الورديات المفتوحة بعد نهاية ساعات العمل الرسمية وفترة السماح.",
                icon: Zap,
              }}
              rules={rules}
              updateRule={updateRule}
              layout="column"
            />

            <NumberField
              label="فترة السماح بعد نهاية الدوام (دقيقة)"
              value={rules.shiftAutoCloseGracePeriod}
              onChange={(value) =>
                updateRule("shiftAutoCloseGracePeriod", value)
              }
              icon={Clock}
              min={0}
              max={120}
            />
            <p className="text-[10px] font-bold text-muted-foreground -mt-2 mr-2">
              المدة التي ينتظرها النظام بعد وقت الإغلاق الرسمي قبل إغلاق الوردية
              تلقائياً
            </p>

            <NumberField
              label="ساعات القفل التلقائي للوردية (إذا نُسيت)"
              value={rules.autoLockShiftHours}
              onChange={(value) => updateRule("autoLockShiftHours", value)}
              icon={Clock}
            />

            <NumberField
              label="تنبيه الكاشير قبل الإغلاق التلقائي (دقيقة)"
              value={rules.shiftCloseWarningMinutes}
              onChange={(value) =>
                updateRule("shiftCloseWarningMinutes", value)
              }
              icon={BellRing}
              min={0}
              max={60}
            />
            <p className="text-[10px] font-bold text-muted-foreground -mt-4 mr-2">
              سيظهر تنبيه للكاشير قبل المدة المحددة لإعلامه بقرب الإغلاق
              التلقائي
            </p>
          </div>

          <div className="mt-4 border-t border-border/50 pt-4">
            <NumberField
              label="العجز النقدي المسموح دون مساءلة (ج.م)"
              value={rules.maxCashDiscrepancyWithoutNote}
              onChange={(value) =>
                updateRule("maxCashDiscrepancyWithoutNote", value)
              }
              icon={AlertTriangle}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function AuditPanel({ rows, searchTerm, setSearchTerm }) {
  return (
    <Card className="rounded-[32px] border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-soft/20 border-b border-border/50">
        <div>
          <h2 className="text-xl font-black text-main flex items-center gap-3">
            <Search className="text-muted-foreground" size={20} /> أرشيف الرقابة
            المتقدم
          </h2>
          <p className="mt-1 text-xs font-bold text-muted-foreground uppercase tracking-widest">
            تتبع العمليات الحساسة كالخصومات، التعديلات، وإلغاء الفواتير.
          </p>
        </div>
        <div className="relative w-full md:w-80 group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors"
            size={16}
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث عن عملية برقم مرجعي..."
            className="h-12 pr-12 rounded-2xl bg-card border-border/60 focus:border-accent shadow-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto p-2">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 bg-soft/30 hover:bg-soft/30">
              <TableHead className="py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right rounded-tr-2xl">
                نوع الإجراء
              </TableHead>
              <TableHead className="py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">
                تفاصيل العملية
              </TableHead>
              <TableHead className="py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right">
                القسم/الكيان
              </TableHead>
              <TableHead className="py-4 text-xs font-black uppercase tracking-widest text-muted-foreground text-right rounded-tl-2xl">
                طابع زمني
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {rows.map((row) => (
              <TableRow
                key={row.id || `${row.action}-${row.created_at}`}
                className="hover:bg-soft/20 transition-colors"
              >
                <TableCell className="py-4">
                  <Badge
                    variant="outline"
                    className="rounded-lg px-3 py-1 bg-card text-[10px] font-bold uppercase tracking-widest"
                  >
                    {row.action || "عملية"}
                  </Badge>
                </TableCell>
                <TableCell className="py-4 max-w-sm truncate font-semibold text-main text-sm">
                  {row.description || "لا يوجد وصف"}
                </TableCell>
                <TableCell className="py-4 text-xs font-bold text-muted-foreground">
                  {row.entity_type || "عام"}
                </TableCell>
                <TableCell
                  className="py-4 text-xs font-bold text-muted-foreground"
                  dir="ltr"
                >
                  {formatDate(row.created_at || row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-64">
                  <TableEmptyState
                    icon={FileLock2}
                    title="لا توجد عمليات رقابية مسجلة"
                    description="قم بتوسيع نطاق البحث أو تأكد من ربط النظام بالخادم."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function ToggleRule({ rule, rules, updateRule, layout = "column" }) {
  const Icon = rule.icon;
  const isChecked = Boolean(rules[rule.key]);
  return (
    <div
      className={cn(
        "flex justify-between gap-4 rounded-2xl border border-border/50 bg-soft/30 p-5 transition-all hover:bg-soft",
        layout === "column" ? "flex-col items-start" : "items-center",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors",
            isChecked
              ? "bg-accent/10 text-accent"
              : "bg-card border border-border/50 text-muted-foreground",
          )}
        >
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm font-black text-main">{rule.title}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground leading-relaxed">
            {rule.description}
          </p>
        </div>
      </div>
      <div
        className={cn(layout === "column" && "w-full flex justify-end mt-2")}
      >
        <Switch
          checked={isChecked}
          onCheckedChange={(c) => updateRule(rule.key, c)}
        />
      </div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  highlight,
  large,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  highlight?: "success" | "danger" | string;
  large?: boolean;
}) {
  const color =
    highlight === "success"
      ? "text-emerald-600"
      : highlight === "danger"
        ? "text-red-600"
        : "text-main";
  return (
    <div className="flex items-center justify-between px-2">
      <span
        className={cn(
          "font-bold text-muted-foreground",
          large ? "text-sm" : "text-xs uppercase tracking-widest",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-black tracking-tight",
          color,
          large ? "text-2xl" : "text-lg",
        )}
        dir="ltr"
      >
        {value}
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  icon: Icon,
}: {
  label: React.ReactNode;
  value: number | string | null | undefined;
  onChange: (_value: number) => void;
  min?: number;
  max?: number | string;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
}) {
  return (
    <label className="block space-y-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-muted-foreground" />}
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <Input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : 0)
        }
        className="h-14 rounded-2xl bg-soft/50 border-border/60 focus:border-accent text-lg font-black px-5 shadow-sm"
        dir="ltr"
      />
    </label>
  );
}
