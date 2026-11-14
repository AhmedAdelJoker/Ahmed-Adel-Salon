import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getIntlLocale } from "@/lib/format/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { formatCurrency, getApiErrorMessage } from "@/lib/core/utils";
import { expenseCatLabelFor } from "@/features/financial-reports/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  PremiumCard,
  StatCard,
  SkeletonCard,
} from "@/components/shared/PremiumUI";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  RefreshCw,
  FileText,
  Search,
  ShieldCheck,
  Trash2,
  Clock,
  Eye,
  Banknote,
  Wallet,
  Users,
  Calendar,
  ArrowUpRight,
  Plus,
} from "lucide-react";

type TabId = "adjustments" | "expenses" | "payroll";

type DecisionDialog = {
  open: boolean;
  action: "approve" | "reject";
  tab: TabId;
  request: any | null;
};

export default function ApprovalsPage() {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>("adjustments");
  const [loading, setLoading] = useState(false);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [totalAdjustments, setTotalAdjustments] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [pageAdjustments, setPageAdjustments] = useState(1);
  const [pageExpenses, setPageExpenses] = useState(1);
  const [pagePayroll, setPagePayroll] = useState(1);
  const SIZE = 50;

  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState<DecisionDialog>({
    open: false,
    action: "approve",
    tab: "adjustments",
    request: null,
  });
  const [managerNote, setManagerNote] = useState("");
  const [submittingId, setSubmittingId] = useState<any | null>(null);

  /* ---------------------------------------------------------------- helpers */
  const monthName = (n: number | string): string => {
    const m = Number(n);
    return m >= 1 && m <= 12 ? t(`payroll.months.m${m}`) : String(n);
  };

  const statusLabel = (status: string): string => {
    const s = String(status || "").toLowerCase();
    if (s === "paid") return t("payroll.statusPaid");
    if (s === "cancelled") return t("payroll.statusCancelled");
    if (s === "audited") return t("payroll.statusAudited");
    if (s === "calculated") return t("payroll.statusCalculated");
    if (s === "pending") return t("approvals.statusPending");
    if (s === "approved") return t("approvals.statusApproved");
    if (s === "rejected") return t("approvals.statusRejected");
    return s ? s : t("approvals.statusCancelled");
  };

  const methodLabel = (v: unknown): string => {
    const k = String(v || "").trim().toLowerCase();
    if (k === "cash") return t("expensesArch.methodCash");
    if (k === "card") return t("expensesArch.methodCard");
    if (k === "bank_transfer") return t("expensesArch.methodBankTransfer");
    if (k === "wallet") return t("expensesArch.methodWallet");
    return k ? k : "—";
  };

  const rowStatusLabel = (r: any, tab: TabId): string => {
    const s = String(r.status || "").toLowerCase();
    if (tab === "expenses") {
      if (s === "pending_audit") return t("approvals.statusPending");
      if (s === "approved") return t("approvals.statusApproved");
      if (s === "rejected") return t("approvals.statusRejected");
      return s ? s : t("approvals.statusCancelled");
    }
    return statusLabel(s);
  };

  const rowStatusVariant = (r: any): "success" | "danger" | "secondary" | "warning" => {
    const s = String(r.status || "").toLowerCase();
    if (s === "approved") return "success";
    if (s === "rejected" || s === "cancelled") return "danger";
    if (s === "audited" || s === "recorded") return "warning";
    return "secondary";
  };

  const typeLabel = (type: string): string => {
    if (type === "discount") return t("approvals.typeDiscount");
    if (type === "payment_method") return t("approvals.typePaymentMethod");
    if (type === "void") return t("approvals.typeVoid");
    return type;
  };

  const adjustmentAmount = (r: any): string => {
    const raw =
      r.requested_values?.new_value ??
      r.requested_values?.amount ??
      r.requested_discount_amount ??
      "";
    const num = Number(raw);
    return Number.isFinite(num) ? formatCurrency(num) : String(raw || "—");
  };

  const formatDateTime = (value?: string | null): string => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString(locale);
    } catch {
      return String(value);
    }
  };

  const getRequestId = (request: any): string | null =>
    request?.id || request?.request_id || request?.requestId || null;

  const getInvoiceNo = (request: any): string =>
    request?.invoice_no ||
    request?.invoiceNo ||
    request?.invoice?.invoice_no ||
    getRequestId(request) ||
    "—";

  /* ---------------------------------------------------------------- fetch */
  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/invoice-adjustment-requests", {
        params: { status: "pending", limit: SIZE, offset: 0 },
      });
      const data = adaptList(res);
      setAdjustments(data);
      setTotalAdjustments(
        Number.isFinite(Number(res?.headers?.["x-total-count"]))
          ? Number(res.headers["x-total-count"])
          : data.length
      );
    } catch {
      toast.error(t("approvals.loadFailed"));
      setAdjustments([]);
      setTotalAdjustments(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/expenses", {
        params: { status: "pending_audit", page: pageExpenses, size: SIZE },
      });
      const data = adaptList(res);
      setExpenses(data);
      setTotalExpenses(
        Number.isFinite(Number(res?.headers?.["x-total-count"]))
          ? Number(res.headers["x-total-count"])
          : data.length
      );
    } catch {
      toast.error(t("approvals.loadFailed"));
      setExpenses([]);
      setTotalExpenses(0);
    } finally {
      setLoading(false);
    }
  }, [pageExpenses]);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/payroll/all", {
        params: { page: pagePayroll, size: SIZE },
      });
      const data = adaptList(res).filter(
        (r: any) => r.status === "generated" || r.status === "draft"
      );
      setPayroll(data);
      setTotalPayroll(
        Number.isFinite(Number(res?.headers?.["x-total-count"]))
          ? Number(res.headers["x-total-count"])
          : data.length
      );
    } catch {
      toast.error(t("approvals.loadFailed"));
      setPayroll([]);
      setTotalPayroll(0);
    } finally {
      setLoading(false);
    }
  }, [pagePayroll]);

  useEffect(() => {
    void fetchAdjustments();
    void fetchExpenses();
    void fetchPayroll();
  }, [fetchAdjustments, fetchExpenses, fetchPayroll]);

  /* ---------------------------------------------------------------- actions */
  const openDecision = (request: any, action: "approve" | "reject") => {
    setDecisionDialog({
      open: true,
      action,
      tab: activeTab,
      request,
    });
    setManagerNote("");
  };

  const submitDecision = async () => {
    const request = decisionDialog.request;
    const requestId = getRequestId(request);
    if (!requestId) {
      toast.error(t("approvals.errRequestNotFound"));
      return;
    }
    if (decisionDialog.action === "reject" && !managerNote.trim()) {
      toast.error(t("approvals.rejectReasonRequired"));
      return;
    }
    setSubmittingId(requestId);
    const actionPath = decisionDialog.action === "approve" ? "approve" : "reject";
    let endpoint: string;
    if (decisionDialog.tab === "adjustments") {
      endpoint = `/invoice-adjustment-requests/${requestId}/${actionPath}`;
    } else if (decisionDialog.tab === "expenses") {
      endpoint = `/expenses/${requestId}/${actionPath}`;
    } else {
      endpoint = `/payroll/${requestId}/cancel`;
    }
    try {
      await api.post(endpoint, { manager_note: managerNote.trim() || undefined });
      toast.success(
        decisionDialog.action === "approve"
          ? t("approvals.toastApproved")
          : t("approvals.toastRejected")
      );
      setDecisionDialog({
        open: false,
        action: "approve",
        tab: decisionDialog.tab,
        request: null,
      });
      setManagerNote("");
      if (decisionDialog.tab === "adjustments") void fetchAdjustments();
      else if (decisionDialog.tab === "expenses") void fetchExpenses();
      else void fetchPayroll();
    } catch (error) {
      console.error("Submit approval decision error:", error);
      toast.error(getApiErrorMessage(error, t("approvals.toastSaveFailed")));
    } finally {
      setSubmittingId(null);
    }
  };

  const openDetail = (row: any) => {
    setDetailItem(row);
    setDetailOpen(true);
  };

  const tabLabel = (tab: TabId): string => {
    if (tab === "adjustments") return t("approvals.tabAdjustments");
    if (tab === "expenses") return t("approvals.tabExpenses");
    return t("approvals.tabPayroll");
  };

  const stats = useMemo(
    () => ({
      adjustments: adjustments.length,
      expenses: expenses.length,
      payroll: payroll.length,
      total: adjustments.length + expenses.length + payroll.length,
    }),
    [adjustments, expenses, payroll]
  );

  return (
    <div className="erp-page-container space-y-6 pb-24">
      <ConfirmDialog
        open={decisionDialog.open}
        onOpenChange={(open) =>
          setDecisionDialog((prev) => ({ ...prev, open }))}
        title={
          decisionDialog.action === "approve"
            ? t("approvals.confirmApproveTitle")
            : t("approvals.confirmRejectTitle")
        }
        description={
          decisionDialog.tab === "expenses"
            ? t("approvals.confirmNoteExpense")
            : t("approvals.confirmNote")
        }
        confirmText={
          decisionDialog.action === "approve"
            ? t("approvals.btnConfirmApprove")
            : t("approvals.btnConfirmReject")
        }
        cancelText={t("approvals.btnCancel")}
        loading={decisionDialog.open && submittingId === decisionDialog.request?.id}
        onConfirm={submitDecision}
      />
      <PageHeader
        title={t("approvals.title")}
        subtitle={t("approvals.subtitle")}
        badge={t("approvals.badge")}
        icon={ShieldCheck}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-11 rounded-xl border-border px-6 font-black"
            >
              <ShieldCheck size={16} className="ms-1.5" /> {t("approvals.statTotalPending")}:{" "}
              {stats.total}
            </Badge>
            <Button
              variant="outline"
              onClick={() => {
                void fetchAdjustments();
                void fetchExpenses();
                void fetchPayroll();
              }}
              disabled={loading}
              className="h-11 rounded-xl gap-1.5"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {t("approvals.refresh")}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumCard className="p-5 group hover:shadow-premium transition-all" delay={0}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest truncate">
                {t("approvals.statPendingAdjustments")}
              </div>
              <div className="text-2xl font-black text-main">{stats.adjustments}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${stats.adjustments > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
        <PremiumCard className="p-5 group hover:shadow-premium transition-all" delay={0.05}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest truncate">
                {t("approvals.statPendingExpenses")}
              </div>
              <div className="text-2xl font-black text-main">{stats.expenses}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${stats.expenses > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
        <PremiumCard className="p-5 group hover:shadow-premium transition-all" delay={0.1}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-widest truncate">
                {t("approvals.statPendingPayroll")}
              </div>
              <div className="text-2xl font-black text-main">{stats.payroll}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${stats.payroll > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
        <PremiumCard className="p-5 group hover:shadow-premium transition-all border-indigo-200 bg-indigo-50/50" delay={0.15}>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
              <Calendar size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate">
                {t("approvals.statTotalPending")}
              </div>
              <div className="text-2xl font-black text-indigo-700">{stats.total}</div>
            </div>
            <div className={`h-2 w-2 rounded-full ${stats.total > 0 ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* ADJUSTMENTS TAB */}
        <PremiumCard noPadding className="overflow-hidden" animate={activeTab === "adjustments" ? undefined : false}>
          <div className="border-b bg-gray-50 p-5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950 dark:text-gray-50">
                {t("approvals.tabAdjustments")}
              </h2>
              <Badge variant="primary" className="rounded-full px-3 py-1 text-[10px] font-black">
                {stats.adjustments}
              </Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[980px]">
              <thead className="bg-gray-50 text-xs font-black text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-5 py-4">{t("approvals.thRequestNo")}</th>
                  <th className="px-5 py-4">{t("approvals.thInvoice")}</th>
                  <th className="px-5 py-4">{t("approvals.thType")}</th>
                  <th className="px-5 py-4">{t("approvals.thAmount")}</th>
                  <th className="px-5 py-4">{t("approvals.thReason")}</th>
                  <th className="px-5 py-4">{t("approvals.thStatus")}</th>
                  <th className="px-5 py-4">{t("approvals.thDate")}</th>
                  <th className="px-5 py-4">{t("approvals.thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {adjustments.length ? (
                  adjustments.map((r) => (
                    <tr key={getRequestId(r)} className="hover:bg-gray-50/70 dark:hover:bg-white/5">
                      <td className="px-5 py-4 font-black">#{getRequestId(r)}</td>
                      <td className="px-5 py-4 font-black">#{getInvoiceNo(r)}</td>
                      <td className="px-5 py-4 font-black text-main truncate max-w-[200px]">
                        {typeLabel(r.request_type)}
                      </td>
                      <td className="px-5 py-4 font-black tabular-nums truncate max-w-[160px]">
                        {adjustmentAmount(r)}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-muted truncate max-w-[240px]">
                        {r.reason || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={rowStatusVariant(r)}>{statusLabel(r.status)}</Badge>
                      </td>
                      <td className="px-5 py-4 text-gray-500 text-sm">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(r)}
                          >
                            {t("approvals.btnViewDetails")}
                          </Button>
                          {r.status === "pending" && (
                                            <>
                              <Button
                                size="sm"
                                onClick={() => openDecision(r, "approve")}
                                disabled={submittingId === getRequestId(r)}
                              >
                                {t("approvals.btnApprove")}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => openDecision(r, "reject")}
                                disabled={submittingId === getRequestId(r)}
                              >
                                {t("approvals.btnReject")}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-20 text-center font-bold text-muted">
                      {t("approvals.noPendingAdjustments")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalAdjustments > SIZE && (
            <div className="border-t border-border bg-soft/20 px-2 py-3">
              <Pagination
                paginator={createPaginationState({
                  page: pageAdjustments,
                  size: SIZE,
                  total: totalAdjustments,
                })}
                onPageChange={setPageAdjustments}
                showSizeChanger={false}
                locale={locale === "ar" ? "ar" : "en"}
              />
            </div>
          )}
        </PremiumCard>

        {/* EXPENSES TAB */}
        <PremiumCard noPadding className="overflow-hidden" animate={activeTab === "expenses" ? undefined : false}>
          <div className="border-b bg-gray-50 p-5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950 dark:text-gray-50">
                {t("approvals.tabExpenses")}
              </h2>
              <Badge variant="primary" className="rounded-full px-3 py-1 text-[10px] font-black">
                {stats.expenses}
              </Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[980px]">
              <thead className="bg-gray-50 text-xs font-black text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-5 py-4">{t("approvals.thRequestNo")}</th>
                  <th className="px-5 py-4">{t("approvals.thEmployee")}</th>
                  <th className="px-5 py-4">{t("approvals.thAmount")}</th>
                  <th className="px-5 py-4">{t("approvals.thReason")}</th>
                  <th className="px-5 py-4">{t("approvals.thStatus")}</th>
                  <th className="px-5 py-4">{t("approvals.thDate")}</th>
                  <th className="px-5 py-4">{t("approvals.thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {expenses.length ? (
                  expenses.map((r) => (
                    <tr key={getRequestId(r)} className="hover:bg-gray-50/70 dark:hover:bg-white/5">
                      <td className="px-5 py-4 font-black">#{getRequestId(r)}</td>
                      <td className="px-5 py-4 font-black text-main truncate max-w-[200px]">
                        {r.recipient_name || "—"}
                      </td>
                      <td className="px-5 py-4 font-black tabular-nums truncate max-w-[140px]">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-muted truncate max-w-[200px]">
                        {expenseCatLabelFor(r.category, t)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={rowStatusVariant(r)}>{rowStatusLabel(r, "expenses")}</Badge>
                      </td>
                      <td className="px-5 py-4 text-gray-500 text-sm">
                        {formatDateTime(r.expense_date || r.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(r)}
                          >
                            {t("approvals.btnViewDetails")}
                          </Button>
                          {r.status === "pending_audit" && (
                                            <>
                              <Button
                                size="sm"
                                onClick={() => openDecision(r, "approve")}
                                disabled={submittingId === getRequestId(r)}
                              >
                                {t("approvals.btnApprove")}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => openDecision(r, "reject")}
                                disabled={submittingId === getRequestId(r)}
                              >
                                {t("approvals.btnReject")}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-20 text-center font-bold text-muted">
                      {t("approvals.noPendingExpenses")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalExpenses > SIZE && (
            <div className="border-t border-border bg-soft/20 px-2 py-3">
              <Pagination
                paginator={createPaginationState({
                  page: pageExpenses,
                  size: SIZE,
                  total: totalExpenses,
                })}
                onPageChange={setPageExpenses}
                showSizeChanger={false}
                locale={locale === "ar" ? "ar" : "en"}
              />
            </div>
          )}
        </PremiumCard>

        {/* PAYROLL TAB */}
        <PremiumCard noPadding className="overflow-hidden" animate={activeTab === "payroll" ? undefined : false}>
          <div className="border-b bg-gray-50 p-5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-950 dark:text-gray-50">
                {t("approvals.tabPayroll")}
              </h2>
              <Badge variant="primary" className="rounded-full px-3 py-1 text-[10px] font-black">
                {stats.payroll}
              </Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[980px]">
              <thead className="bg-gray-50 text-xs font-black text-gray-500 dark:bg-white/5">
                <tr>
                  <th className="px-5 py-4">{t("approvals.thRequestNo")}</th>
                  <th className="px-5 py-4">{t("approvals.thEmployee")}</th>
                  <th className="px-5 py-4">{t("approvals.thPeriod")}</th>
                  <th className="px-5 py-4">{t("approvals.thNetSalary")}</th>
                  <th className="px-5 py-4">{t("approvals.thStatus")}</th>
                  <th className="px-5 py-4">{t("approvals.thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {payroll.length ? (
                  payroll.map((r) => (
                    <tr key={getRequestId(r)} className="hover:bg-gray-50/70 dark:hover:bg-white/5">
                      <td className="px-5 py-4 font-black">#{getRequestId(r)}</td>
                      <td className="px-5 py-4 font-black text-main truncate max-w-[200px]">
                        {r.employee_name || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-muted tabular-nums">
                        {monthName(r.period_month)} {r.period_year}
                      </td>
                      <td className="px-5 py-4 font-black tabular-nums truncate max-w-[140px]">
                        {formatCurrency(r.net_salary)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={rowStatusVariant(r)}>{rowStatusLabel(r, "payroll")}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(r)}
                          >
                            {t("approvals.btnViewDetails")}
                          </Button>
                          {(r.status === "generated" || r.status === "draft") && (
                                            <>
                              <Button
                                size="sm"
                                onClick={() => openDecision(r, "approve")}
                                disabled={submittingId === getRequestId(r)}
                              >
                                {t("approvals.btnApprove")}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => openDecision(r, "reject")}
                                disabled={submittingId === getRequestId(r)}
                              >
                                {t("approvals.btnReject")}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center font-bold text-muted">
                      {t("approvals.noPendingPayroll")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPayroll > SIZE && (
            <div className="border-t border-border bg-soft/20 px-2 py-3">
              <Pagination
                paginator={createPaginationState({
                  page: pagePayroll,
                  size: SIZE,
                  total: totalPayroll,
                })}
                onPageChange={setPagePayroll}
                showSizeChanger={false}
                locale={locale === "ar" ? "ar" : "en"}
              />
            </div>
          )}
        </PremiumCard>
      </div>

      {/* DETAIL DIALOG */}
      <Dialog open={detailOpen} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{t("approvals.detailsTitle")}</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted">{t("approvals.detailsSubtitle")}</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-black text-gray-500">{t("approvals.detailsRequestNo")}</div>
                  <div className="mt-1 font-black">#{getRequestId(detailItem)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-black text-gray-500">{t("approvals.thInvoice")}</div>
                  <div className="mt-1 font-black">#{getInvoiceNo(detailItem)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-black text-gray-500">{t("approvals.thType")}</div>
                  <div className="mt-1 font-black">{typeLabel(detailItem.request_type)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-black text-gray-500">{t("approvals.thAmount")}</div>
                  <div className="mt-1 font-black tabular-nums">{adjustmentAmount(detailItem)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-black text-gray-500">{t("approvals.thStatus")}</div>
                  <div className="mt-1 font-black">{statusLabel(detailItem.status || detailItem.status)}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-black text-gray-500">{t("approvals.thDate")}</div>
                  <div className="mt-1 font-black">{formatDateTime(detailItem.created_at || detailItem.transaction_date)}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                <div className="text-xs font-black text-gray-500">{t("approvals.thReason")}</div>
                <div className="mt-2 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                  {detailItem.reason || "—"}
                </div>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                <div className="text-xs font-black text-gray-500">{t("approvals.detailsNotes")}</div>
                <div className="mt-2 text-sm font-bold leading-relaxed whitespace-pre-wrap">
                  {detailItem.notes || "—"}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              {t("approvals.btnCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
