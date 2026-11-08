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
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { useFinancialRules, paymentLabels, formatCurrency, formatDate } from "@/features/financial-rules";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";

const TABS = [
  { id: "overview", label: "finRules.tabs.overview", icon: TrendingUp },
  { id: "rules", label: "finRules.tabs.rules", icon: Receipt },
  { id: "payments", label: "finRules.tabs.payments", icon: Wallet },
  { id: "audit", label: "finRules.tabs.audit", icon: FileLock2 },
];

export default function FinancialRules({ hideChrome = false }: { hideChrome?: boolean }) {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
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
          {t("finRules.unsaved")}
        </Badge>
      )}
      <Button
        onClick={() => loadData({ background: true })}
        loading={refreshing}
        disabled={refreshing}
        variant="outline"
        className="h-11 gap-2 text-xs font-black"
      >
        <RefreshCw size={15} className={cn(refreshing && "animate-spin")} /> {t("finRules.sync")}
      </Button>
      <Button
        onClick={exportRules}
        variant="outline"
        className="h-11 gap-2 text-xs font-black"
      >
        <Download size={15} /> {t("finRules.exportLog")}
      </Button>
      {isDirty && (
        <Button
          onClick={discardChanges}
          disabled={saving}
          variant="ghost"
          className="h-11 gap-2 text-xs font-black text-muted"
        >
          <Undo2 size={15} /> {t("finRules.undo")}
        </Button>
      )}
      <Button
        onClick={saveRules}
        loading={saving}
        disabled={saving || !isDirty}
        title={isDirty ? t("finRules.saveTitleOn") : t("finRules.saveTitleOff")}
        className="h-11 gap-2 px-6 text-xs font-black"
      >
        <Save size={15} /> {t("finRules.save")}
      </Button>
    </>
  );

  return (
    <div className={cn(!hideChrome && "erp-page-container space-y-6 pb-16", hideChrome && "space-y-6")}>
      {hideChrome ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-3 shadow-sm print:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-main">{t("finRules.title")}</p>
            <p className="truncate text-[11px] font-bold text-muted">
              {t("finRules.compactSubtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        </div>
      ) : (
        <PageHeader
          title={t("finRules.title")}
          subtitle={t("finRules.subtitle")}
          badge={t("finRules.badge")}
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
              <tab.icon size={14} /> {t("finRules.tabs." + tab.id)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewPanel rules={rules} metrics={metrics} isDirty={isDirty} t={t} />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <RulesPanel rules={rules} updateRule={updateRule} t={t} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsPanel
            rules={rules}
            updateRule={updateRule}
            updatePaymentMethod={updatePaymentMethod}
            t={t}
          />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel
            rows={filteredAuditRows}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            t={t}
            locale={locale}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewPanel({ rules, metrics, isDirty, t }: { rules: Record<string, any>; metrics: { revenue: number; expenseTotal: number; net: number; discounts: number; openShifts: number }; isDirty: boolean; t: any }) {
  const checks = [
    { title: t("finRules.check.vat"), value: rules.taxRate > 0, icon: Percent },
    {
      title: t("finRules.check.suspicious"),
      value: rules.enableSuspiciousDiscountAlerts,
      icon: BellRing,
    },
    {
      title: t("finRules.check.reason"),
      value: rules.requireDiscountReason,
      icon: BadgePercent,
    },
    {
      title: t("finRules.check.managerApproval"),
      value: rules.requireManagerApprovalAboveLimit,
      icon: ShieldAlert,
    },
    {
      title: t("finRules.check.shiftBinding"),
      value: rules.requireOpenShiftForInvoices,
      icon: Lock,
    },
    {
      title: t("finRules.check.lockClosed"),
      value: rules.lockInvoicesAfterShiftClose,
      icon: FileLock2,
    },
    {
      title: t("finRules.check.expenseApproval"),
      value: rules.enableExpenseApproval,
      icon: FileCheck2,
    },
    {
      title: t("finRules.check.noNegative"),
      value: !rules.allowNegativeInventory,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      <div data-stats-grid="true">
        <CurrencyStatCard
          label={t("finRules.stats.revenueToday")}
          value={metrics.revenue}
          icon={Banknote}
          variant="success"
          hint={t("finRules.stats.revenueHint")}
        />
        <CurrencyStatCard
          label={t("finRules.stats.expenseToday")}
          value={metrics.expenseTotal}
          icon={CreditCard}
          variant="danger"
          hint={t("finRules.stats.expenseHint")}
        />
        <CurrencyStatCard
          label={t("finRules.stats.netToday")}
          value={metrics.net}
          icon={TrendingUp}
          variant={metrics.net >= 0 ? "primary" : "danger"}
          hint={t("finRules.stats.netHint")}
        />
        <CurrencyStatCard
          label={t("finRules.stats.discounts")}
          value={metrics.discounts}
          icon={BadgePercent}
          variant="secondary"
          hint={t("finRules.stats.discountsHint")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" /> {t("finRules.protection.title")}
            </span>
          }
          subtitle={t("finRules.protection.subtitle")}
          className="lg:col-span-2"
          actions={
            isDirty ? (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] font-black text-amber-700">
                {t("finRules.protection.draftBadge")}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[10px] font-black text-emerald-700">
                {t("finRules.protection.savedBadge")}
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
              <Zap size={16} className="text-primary" /> {t("finRules.live.title")}
            </span>
          }
        >
          <div className="space-y-4">
            <SummaryLine
              label={t("finRules.live.revenue")}
              value={formatCurrency(metrics.revenue)}
            />
            <SummaryLine
              label={t("finRules.live.spent")}
              value={formatCurrency(metrics.expenseTotal)}
            />
            <div className="my-4 border-t border-dashed border-border/60" />
            <SummaryLine
              label={t("finRules.live.net")}
              value={formatCurrency(metrics.net)}
              highlight={metrics.net >= 0 ? "success" : "danger"}
              large
            />
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <span className="text-xs font-bold text-muted">
                {t("finRules.live.openShifts")}
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

function RulesPanel({ rules, updateRule, t }: { rules: Record<string, any>; updateRule: (key: string, value: any) => void; t: any }) {
  const booleanRules = [
    {
      key: "enableSuspiciousDiscountAlerts",
      title: t("finRules.check.suspicious"),
      description: t("finRules.rulesPanel.suspiciousDesc"),
      icon: BellRing,
    },
    {
      key: "requireDiscountReason",
      title: t("finRules.check.reason"),
      description: t("finRules.rulesPanel.reasonDesc"),
      icon: BadgePercent,
    },
    {
      key: "requireManagerApprovalAboveLimit",
      title: t("finRules.check.managerApproval"),
      description: t("finRules.rulesPanel.approvalDesc"),
      icon: ShieldAlert,
    },
    {
      key: "enableExpenseApproval",
      title: t("finRules.check.expenseApproval"),
      description: t("finRules.rulesPanel.expenseDesc"),
      icon: FileCheck2,
    },
    {
      key: "enableProductCostTracking",
      title: t("finRules.rulesPanel.costTitle"),
      description: t("finRules.rulesPanel.costDesc"),
      icon: Calculator,
    },
    {
      key: "allowNegativeInventory",
      title: t("finRules.rulesPanel.negativeTitle"),
      description: t("finRules.rulesPanel.negativeDesc"),
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ContentPanel
        title={
          <span className="flex items-center gap-2">
            <Receipt size={16} className="text-primary" /> {t("finRules.rulesPanel.title")}
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
            <Calculator size={16} className="text-primary" /> {t("finRules.rulesPanel.limitsTitle")}
          </span>
        }
      >
        <div className="space-y-5">
          <NumberField
            label={t("finRules.field.taxRate")}
            value={rules.taxRate}
            onChange={(value) => updateRule("taxRate", value)}
            icon={Percent}
            max={100}
            hint={t("finRules.field.taxRateHint")}
          />
          <NumberField
            label={t("finRules.field.cashierLimit")}
            value={rules.cashierDiscountLimit}
            onChange={(value) => updateRule("cashierDiscountLimit", value)}
            icon={BadgePercent}
            max={100}
            hint={t("finRules.field.cashierLimitHint")}
          />
          <NumberField
            label={t("finRules.field.maxInvoice")}
            value={rules.maxInvoiceWithoutApproval}
            onChange={(value) => updateRule("maxInvoiceWithoutApproval", value)}
            icon={Banknote}
            hint={t("finRules.field.maxInvoiceHint")}
          />
        </div>
      </ContentPanel>
    </div>
  );
}

function PaymentsPanel({ rules, updateRule, updatePaymentMethod, t }: { rules: Record<string, any>; updateRule: (key: string, value: any) => void; updatePaymentMethod: (key: string, value: boolean) => void; t: any }) {
  const methods = ["cash", "card", "wallet", "instapay"];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ContentPanel
        title={
          <span className="flex items-center gap-2">
            <Lock size={16} className="text-primary" /> {t("finRules.cash.title")}
          </span>
        }
        className="lg:col-span-2"
      >
        <div className="mb-6 space-y-3">
          <ToggleRule
            rule={{
              key: "requireOpenShiftForInvoices",
              title: t("finRules.cash.openShiftTitle"),
              description:
                t("finRules.cash.openShiftDesc"),
              icon: Lock,
            }}
            rules={rules}
            updateRule={updateRule}
            layout="row"
          />
          <ToggleRule
            rule={{
              key: "lockInvoicesAfterShiftClose",
              title: t("finRules.cash.lockTitle"),
              description:
                t("finRules.cash.lockDesc"),
              icon: FileLock2,
            }}
            rules={rules}
            updateRule={updateRule}
            layout="row"
          />
        </div>

        <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted">
          {t("finRules.cash.channelsTitle")}
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
                  {t(paymentLabels[method])}
                </span>
              </div>
              <Switch
                checked={Boolean(rules.enabledPaymentMethods?.[method])}
                onCheckedChange={(checked) =>
                  updatePaymentMethod(method, checked)
                }
                aria-label={t("finRules.cash.enableVia", { label: t(paymentLabels[method]) })}
              />
            </div>
          ))}
        </div>
      </ContentPanel>

      <div className="space-y-6">
        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-primary" /> {t("finRules.pref.title")}
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
                  <span>{t(paymentLabels[method])}</span>
                  {selected && <CheckCircle2 size={18} />}
                </button>
              );
            })}
          </div>
        </ContentPanel>

        <ContentPanel
          title={
            <span className="flex items-center gap-2">
              <Settings2 size={16} className="text-primary" /> {t("finRules.autoClose.title")}
            </span>
          }
        >
          <div className="space-y-5">
            <ToggleRule
              rule={{
                key: "enableAutoShiftClose",
                title: t("finRules.autoClose.title"),
                description:
                  t("finRules.autoClose.ruleDesc"),
                icon: Zap,
              }}
              rules={rules}
              updateRule={updateRule}
              layout="column"
            />

            <NumberField
              label={t("finRules.field.grace")}
              value={rules.shiftAutoCloseGracePeriod}
              onChange={(value) =>
                updateRule("shiftAutoCloseGracePeriod", value)
              }
              icon={Clock}
              min={0}
              max={120}
              hint={t("finRules.field.graceHint")}
            />

            <NumberField
              label={t("finRules.field.autoLock")}
              value={rules.autoLockShiftHours}
              onChange={(value) => updateRule("autoLockShiftHours", value)}
              icon={Clock}
              min={0}
              max={168}
              hint={t("finRules.field.autoLockHint")}
            />

            <NumberField
              label={t("finRules.field.closeWarning")}
              value={rules.shiftCloseWarningMinutes}
              onChange={(value) =>
                updateRule("shiftCloseWarningMinutes", value)
              }
              icon={BellRing}
              min={0}
              max={60}
              hint={t("finRules.field.closeWarningHint")}
            />

            <div className="border-t border-border/50 pt-5">
              <NumberField
                label={t("finRules.field.discrepancy")}
                value={rules.maxCashDiscrepancyWithoutNote}
                onChange={(value) =>
                  updateRule("maxCashDiscrepancyWithoutNote", value)
                }
                icon={AlertTriangle}
                hint={t("finRules.field.discrepancyHint")}
              />
            </div>
          </div>
        </ContentPanel>
      </div>
    </div>
  );
}

function AuditPanel({ rows, searchTerm, setSearchTerm, t, locale }: { rows: Record<string, any>[]; searchTerm: string; setSearchTerm: (v: string) => void; t: any; locale: string }) {
  return (
    <ContentPanel
      title={
        <span className="flex items-center gap-2">
          <Search size={16} className="text-primary" /> {t("finRules.audit.title")}
        </span>
      }
      subtitle={t("finRules.audit.subtitle")}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {t("finRules.audit.count", { n: rows.length })}
          </Badge>
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("finRules.audit.searchPlaceholder")}
              aria-label={t("finRules.audit.searchAria")}
              className="h-11 rounded-xl border-border/60 bg-card pe-11 text-xs font-bold shadow-sm focus-visible:ring-primary/30"
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
                {t("finRules.audit.thAction")}
              </TableHead>
              <TableHead className="py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                {t("finRules.audit.thDetails")}
              </TableHead>
              <TableHead className="py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                {t("finRules.audit.thEntity")}
              </TableHead>
              <TableHead className="rounded-tl-2xl py-4 text-right text-xs font-black uppercase tracking-widest text-muted">
                {t("finRules.audit.thTime")}
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
                    {row.action || t("finRules.audit.fallbackAction")}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-sm truncate py-4 text-sm font-semibold text-main">
                  {row.description || t("finRules.audit.noDesc")}
                </TableCell>
                <TableCell className="py-4 text-xs font-bold text-muted">
                  {row.entity_type || t("finRules.audit.genericEntity")}
                </TableCell>
                <TableCell
                  className="py-4 text-xs font-bold tabular-nums text-muted"
                  dir="ltr"
                >
                  {formatDate(row.created_at || row.createdAt, locale)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-64">
                  <EmptyState variant="table"
                    icon={FileLock2}
                    title={t("finRules.audit.emptyTitle")}
                    message={t("finRules.audit.emptyMessage")}
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
