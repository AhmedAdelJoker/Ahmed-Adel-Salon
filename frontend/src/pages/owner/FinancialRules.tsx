import React from "react";
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
  Lock,
  Percent,
  Receipt,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Undo2,
  Wallet,
  XCircle,
  Zap,
  BellRing,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContentPanel,
  PageHeader,
  SkeletonCard,
} from "@/components/shared/PremiumUI";
import {
  CurrencyStatCard,
} from "@/components/shared/DisplayComponents";
import InlineNotice from "@/components/shared/InlineNotice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/core/utils";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { useFinancialRules, paymentLabels, formatCurrency, formatDate } from "@/features/financial-rules";

const TABS = [
  { id: "overview", label: "نظرة عامة والملخص", icon: TrendingUp },
  { id: "rules", label: "قواعد الفواتير والضرائب", icon: Receipt },
  { id: "payments", label: "المدفوعات والورديات", icon: Wallet },
  { id: "audit", label: "سجل الرقابة المالية", icon: FileLock2 },
];

export default function FinancialRules({ hideChrome = false }: { hideChrome?: boolean }) {
  const {
    loading,
    saving,
    refreshing,
    activeTab,
    setActiveTab,
    rules,
    isDirty,
    searchTerm,
    setSearchTerm,
    syncStatus,
    metrics,
    filteredAuditRows,
    updateRule,
    updatePaymentMethod,
    discardChanges,
    saveRules,
    exportRules,
    loadData,
  } = useFinancialRules();

  if (loading) {
    return (
      <div className="erp-page-container space-y-6 pb-16">
        <div data-stats-grid="true">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
        <SkeletonCard variant="content" />
      </div>
    );
  }

  const headerActions = (
    <>
      {isDirty && (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] font-black text-amber-700">
          تعديلات غير محفوظة
        </Badge>
      )}
      <Button
        onClick={() => loadData({ background: true })}
        loading={refreshing}
        disabled={refreshing}
        variant="outline"
        className="h-11 gap-2 text-xs font-black"
      >
        <RefreshCw size={15} className={cn(refreshing && "animate-spin")} /> مزامنة
      </Button>
      <Button
        onClick={exportRules}
        variant="outline"
        className="h-11 gap-2 text-xs font-black"
      >
        <Download size={15} /> تصدير السجل
      </Button>
      {isDirty && (
        <Button
          onClick={discardChanges}
          disabled={saving}
          variant="ghost"
          className="h-11 gap-2 text-xs font-black text-muted"
        >
          <Undo2 size={15} /> تراجع
        </Button>
      )}
      <Button
        onClick={saveRules}
        loading={saving}
        disabled={saving || !isDirty}
        title={isDirty ? "حفظ القواعد المالية" : "لا توجد تعديلات للحفظ"}
        className="h-11 gap-2 px-6 text-xs font-black"
      >
        <Save size={15} /> توثيق القواعد
      </Button>
    </>
  );

  return (
    <div className={cn(!hideChrome && "erp-page-container space-y-6 pb-16", hideChrome && "space-y-6")}>
      {hideChrome ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm print:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-main">القواعد المالية</p>
            <p className="truncate text-[11px] font-bold text-muted">
              الضرائب، سياسات الخصم، طرق الدفع، ومعايير الورديات
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        </div>
      ) : (
        <PageHeader
          title="القواعد المالية"
          subtitle="التحكم في الضرائب، سياسات الخصم، طرق الدفع، ومعايير فتح وإغلاق الورديات."
          badge="محرك الرقابة"
          icon={ShieldCheck}
          actions={<div className="flex flex-wrap items-center gap-2 print:hidden">{headerActions}</div>}
        />
      )}

      {syncStatus.lastMessage ? (
        <InlineNotice
          tone={syncStatus.rulesSource === "local" ? "warning" : "info"}
          className="rounded-2xl border-border/50 shadow-sm"
        >
          {syncStatus.lastMessage}
        </InlineNotice>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto p-1.5 print:hidden">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs font-black">
              <tab.icon size={14} /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewPanel rules={rules} metrics={metrics} isDirty={isDirty} />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RulesPanel rules={rules} updateRule={updateRule} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsPanel
            rules={rules}
            updateRule={updateRule}
            updatePaymentMethod={updatePaymentMethod}
          />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel
            rows={filteredAuditRows}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewPanel({ rules, metrics, isDirty }: { rules: Record<string, any>; metrics: { revenue: number; expenseTotal: number; net: number; discounts: number; openShifts: number }; isDirty: boolean }) {
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
      <div data-stats-grid="true">
        <CurrencyStatCard
          label="إيرادات اليوم"
          value={metrics.revenue}
          icon={Banknote}
          variant="success"
          hint="فواتير اليوم"
        />
        <CurrencyStatCard
          label="مصروفات اليوم"
          value={metrics.expenseTotal}
          icon={CreditCard}
          variant="danger"
          hint="مصروفات اليوم"
        />
        <CurrencyStatCard
          label="صافي اليوم"
          value={metrics.net}
          icon={TrendingUp}
          variant={metrics.net >= 0 ? "primary" : "danger"}
          hint="الإيراد − المنصرف"
        />
        <CurrencyStatCard
          label="إجمالي الخصومات"
          value={metrics.discounts}
          icon={BadgePercent}
          variant="secondary"
          hint="من فواتير اليوم"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" /> حالة الحماية الرقابية
            </span>
          }
          subtitle="مدى صرامة القواعد المطبقة بالنظام"
          className="lg:col-span-2"
          actions={
            isDirty ? (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] font-black text-amber-700">
                مسودة غير محفوظة
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] font-black text-emerald-700">
                موثق ومفعل
              </Badge>
            )
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {checks.map((check) => (
              <div
                key={check.title}
                className="flex items-center justify-between rounded-2xl border border-border/40 bg-soft/40 p-4 transition-colors hover:bg-soft"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      check.value
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    <check.icon size={16} />
                  </div>
                  <span className="truncate text-sm font-bold text-main">
                    {check.title}
                  </span>
                </div>
                {check.value ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
                ) : (
                  <XCircle size={18} className="shrink-0 text-rose-500" />
                )}
              </div>
            ))}
          </div>
        </ContentPanel>

        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <Zap size={16} className="text-primary" /> ملخص الحركة المباشرة
            </span>
          }
        >
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
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <span className="text-xs font-bold text-muted">
                الورديات المفتوحة (درج النقود)
              </span>
              <span className="text-lg font-black tabular-nums text-primary">
                {metrics.openShifts}
              </span>
            </div>
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}

function RulesPanel({ rules, updateRule }: { rules: Record<string, any>; updateRule: (key: string, value: any) => void }) {
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ContentPanel
        title={
          <span className="flex items-center gap-2">
            <Receipt size={16} className="text-primary" /> سياسات الفواتير والخصم
          </span>
        }
        className="lg:col-span-2"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {booleanRules.map((rule) => (
            <ToggleRule
              key={rule.key}
              rule={rule}
              rules={rules}
              updateRule={updateRule}
            />
          ))}
        </div>
      </ContentPanel>

      <ContentPanel
        title={
          <span className="flex items-center gap-2">
            <Calculator size={16} className="text-primary" /> القيم والحدود المالية
          </span>
        }
      >
        <div className="space-y-5">
          <NumberField
            label="نسبة الضريبة (VAT) %"
            value={rules.taxRate}
            onChange={(value) => updateRule("taxRate", value)}
            icon={Percent}
            max={100}
            hint="النسبة المطبقة على الفواتير (0 – 100)"
          />
          <NumberField
            label="حد خصم الكاشير (%)"
            value={rules.cashierDiscountLimit}
            onChange={(value) => updateRule("cashierDiscountLimit", value)}
            icon={BadgePercent}
            max={100}
            hint="الأعلى من ذلك يتطلب اعتماد مدير (0 – 100)"
          />
          <NumberField
            label="أقصى قيمة للفاتورة بدون اعتماد (ج.م)"
            value={rules.maxInvoiceWithoutApproval}
            onChange={(value) => updateRule("maxInvoiceWithoutApproval", value)}
            icon={Banknote}
            hint="الفواتير الأعلى من هذا المبلغ تتطلب اعتماداً"
          />
        </div>
      </ContentPanel>
    </div>
  );
}

function PaymentsPanel({ rules, updateRule, updatePaymentMethod }: { rules: Record<string, any>; updateRule: (key: string, value: any) => void; updatePaymentMethod: (key: string, value: boolean) => void }) {
  const methods = ["cash", "card", "wallet", "instapay"];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ContentPanel
        title={
          <span className="flex items-center gap-2">
            <Lock size={16} className="text-primary" /> ضوابط درج النقود والورديات
          </span>
        }
        className="lg:col-span-2"
      >
        <div className="mb-6 space-y-3">
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

        <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted">
          قنوات الدفع المسموحة للعملاء
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {methods.map((method) => (
            <div
              key={method}
              className="flex items-center justify-between rounded-2xl border border-border/50 bg-soft/50 p-4 transition-colors hover:bg-soft"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card text-main shadow-sm">
                  {method === "cash" ? (
                    <Banknote size={18} />
                  ) : method === "card" ? (
                    <CreditCard size={18} />
                  ) : (
                    <Wallet size={18} />
                  )}
                </div>
                <span className="truncate text-sm font-bold text-main">
                  {paymentLabels[method]}
                </span>
              </div>
              <Switch
                checked={Boolean(rules.enabledPaymentMethods?.[method])}
                onCheckedChange={(checked) =>
                  updatePaymentMethod(method, checked)
                }
                aria-label={`تفعيل الدفع عبر ${paymentLabels[method]}`}
              />
            </div>
          ))}
        </div>
      </ContentPanel>

      <div className="space-y-6">
        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary" /> التفضيل الافتراضي للدفع
            </span>
          }
        >
          <div className="space-y-2.5">
            {methods.map((method) => {
              const selected = rules.defaultPaymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => updateRule("defaultPaymentMethod", method)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border p-4 text-right text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selected
                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                      : "border-border/50 bg-soft/30 text-muted hover:bg-soft hover:text-main",
                  )}
                >
                  <span>{paymentLabels[method]}</span>
                  {selected && <CheckCircle2 size={18} />}
                </button>
              );
            })}
          </div>
        </ContentPanel>

        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <Settings2 size={16} className="text-primary" /> الإغلاق التلقائي للورديات
            </span>
          }
        >
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
              hint="المدة بعد وقت الإغلاق الرسمي قبل الإغلاق التلقائي (0 – 120)"
            />

            <NumberField
              label="ساعات القفل التلقائي للوردية (إذا نُسيت)"
              value={rules.autoLockShiftHours}
              onChange={(value) => updateRule("autoLockShiftHours", value)}
              icon={Clock}
              hint="إغلاق احترازي إذا تُركت الوردية مفتوحة"
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
              hint="تنبيه الكاشير بقرب الإغلاق التلقائي (0 – 60)"
            />

            <div className="border-t border-border/50 pt-5">
              <NumberField
                label="العجز النقدي المسموح دون مساءلة (ج.م)"
                value={rules.maxCashDiscrepancyWithoutNote}
                onChange={(value) =>
                  updateRule("maxCashDiscrepancyWithoutNote", value)
                }
                icon={AlertTriangle}
                hint="عجز أكبر من هذا المبلغ يتطلب ملاحظة توضيحية"
              />
            </div>
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}

function AuditPanel({ rows, searchTerm, setSearchTerm }: { rows: Record<string, any>[]; searchTerm: string; setSearchTerm: (v: string) => void }) {
  return (
    <ContentPanel
      title={
        <span className="flex items-center gap-2">
          <Search size={16} className="text-primary" /> أرشيف الرقابة المتقدم
        </span>
      }
      subtitle="تتبع العمليات الحساسة كالخصومات، التعديلات، وإلغاء الفواتير."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {rows.length} عملية
          </Badge>
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالنوع أو الوصف أو القسم..."
              aria-label="بحث في سجل الرقابة"
              className="h-11 rounded-xl border-border/60 bg-card pr-11 text-xs font-bold shadow-sm focus-visible:ring-primary/30"
            />
          </div>
        </div>
      }
      noPadding
    >
      <div className="overflow-x-auto p-2">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 bg-soft/30 hover:bg-soft/30">
              <TableHead className="rounded-tr-2xl py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                نوع الإجراء
              </TableHead>
              <TableHead className="py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                تفاصيل العملية
              </TableHead>
              <TableHead className="py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                القسم/الكيان
              </TableHead>
              <TableHead className="rounded-tl-2xl py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                طابع زمني
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/50">
            {rows.map((row) => (
              <TableRow
                key={row.id || `${row.action}-${row.created_at}`}
                className="transition-colors hover:bg-soft/20"
              >
                <TableCell className="py-4">
                  <Badge
                    variant="outline"
                    className="rounded-lg bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                  >
                    {row.action || "عملية"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-sm truncate py-4 text-sm font-semibold text-main">
                  {row.description || "لا يوجد وصف"}
                </TableCell>
                <TableCell className="py-4 text-xs font-bold text-muted">
                  {row.entity_type || "عام"}
                </TableCell>
                <TableCell
                  className="py-4 text-xs font-bold tabular-nums text-muted"
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
                    description="جرّب كلمة بحث مختلفة أو تأكد من اتصال النظام بالخادم."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ContentPanel>
  );
}

function ToggleRule({ rule, rules, updateRule, layout = "column" }: { rule: { key: string; title: string; description: string; icon: any }; rules: Record<string, any>; updateRule: (key: string, value: any) => void; layout?: "column" | "row" }) {
  const Icon = rule.icon;
  const isChecked = Boolean(rules[rule.key]);
  return (
    <div
      className={cn(
        "flex justify-between gap-4 rounded-2xl border border-border/50 bg-soft/30 p-5 transition-all hover:bg-soft",
        layout === "column" ? "flex-col items-start" : "items-center",
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm transition-colors",
            isChecked
              ? "bg-primary/10 text-primary"
              : "border border-border/50 bg-card text-muted",
          )}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-main">{rule.title}</p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-muted">
            {rule.description}
          </p>
        </div>
      </div>
      <div
        className={cn(layout === "column" && "mt-2 flex w-full justify-end")}
      >
        <Switch
          checked={isChecked}
          onCheckedChange={(c) => updateRule(rule.key, c)}
          aria-label={rule.title}
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
      ? "text-emerald-600 dark:text-emerald-400"
      : highlight === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : "text-main";
  return (
    <div className="flex items-center justify-between px-2">
      <span
        className={cn(
          "font-bold text-muted",
          large ? "text-sm" : "text-xs uppercase tracking-widest",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-black tabular-nums tracking-tight",
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
  hint,
  icon: Icon,
}: {
  label: React.ReactNode;
  value: number | string | null | undefined;
  onChange: (_value: number) => void;
  min?: number;
  max?: number | string;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
}) {
  return (
    <label className="block space-y-2.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="shrink-0 text-muted" />}
        <span className="text-[10px] font-black uppercase tracking-widest text-muted">
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
        className="h-14 rounded-2xl border-border/60 bg-soft/50 px-5 text-lg font-black tabular-nums shadow-sm focus-visible:ring-primary/30"
        dir="ltr"
      />
      {hint && (
        <p className="text-[10px] font-bold leading-relaxed text-muted">{hint}</p>
      )}
    </label>
  );
}
