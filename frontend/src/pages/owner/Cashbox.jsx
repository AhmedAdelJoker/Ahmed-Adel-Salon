import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  FileText,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  PieChart,
  Clock,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Printer,
} from "lucide-react";
import { toast } from "react-hot-toast";
import cashboxService from "../../services/cashboxService";
import api from "../../services/api";
import { adaptList, adaptObject } from "../../services/apiAdapter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatCurrency } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_LABELS = {
  invoice_payment: "تحصيل فاتورة",
  expense_payment: "دفع مصروف",
  manual_deposit: "إيداع يدوي",
  manual_withdraw: "سحب يدوي",
  opening_balance: "رصيد افتتاحي",
  closing_balance: "رصيد إغلاق",
  refund: "استرداد",
};

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value);
  }
}

export default function Cashbox() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    total_in: 0,
    total_out: 0,
    cash_balance: 0,
    today_sales: 0,
    today_expenses: 0,
    today_net: 0,
  });
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashType, setCashType] = useState("in");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [directionFilter, setDirectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [activeTab, setActiveTab] = useState("all");

  async function loadCashbox(silent = false) {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      const [summaryRes, txRes] = await Promise.all([
        cashboxService.getSummary(),
        cashboxService.listTransactions({ limit: 200 }),
      ]);
      setSummary(adaptObject(summaryRes, {}));
      setTransactions(adaptList(txRes));
    } catch (error) {
      console.error("Cashbox load error:", error);
      toast.error("فشل تحميل بيانات الخزنة");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCashbox();
  }, []);

  const visibleRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
    
    return transactions.filter((row) => {
      const rowDate = row.transaction_date || row.created_at ? new Date(row.transaction_date || row.created_at) : null;
      const isVoided = Number(row.is_voided || 0) === 1;

      if (activeTab === "in" && row.direction !== "in") return false;
      if (activeTab === "out" && row.direction !== "out") return false;
      if (activeTab === "voided" && !isVoided) return false;

      if (quickFilter === "today") {
        if (!rowDate) return false;
        if (rowDate.getFullYear() !== now.getFullYear() || rowDate.getMonth() !== now.getMonth() || rowDate.getDate() !== now.getDate()) return false;
      }
      
      if (start && (!rowDate || rowDate < start)) return false;
      if (end && (!rowDate || rowDate > end)) return false;
      
      if (directionFilter !== "all" && row.direction !== directionFilter) return false;
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      
      if (!term) return true;
      return [row.transaction_no, row.reference_no, row.type, row.notes, row.payment_method]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [transactions, directionFilter, typeFilter, searchTerm, quickFilter, startDate, endDate, activeTab]);

  const stats = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    }).reverse();

    const dataMap = {};
    last7Days.forEach(date => dataMap[date] = { in: 0, out: 0 });

    transactions.forEach(row => {
      if (Number(row.is_voided) === 1) return;
      const date = (row.transaction_date || row.created_at || "").slice(0, 10);
      if (dataMap[date]) {
        if (row.direction === "in") dataMap[date].in += Number(row.amount || 0);
        else dataMap[date].out += Number(row.amount || 0);
      }
    });

    return Object.entries(dataMap).map(([date, val]) => ({ date, ...val }));
  }, [transactions]);

  async function handleCreateCash() {
    try {
      if (cashType === "out" && Number(cashAmount) > Number(summary.cash_balance)) {
        toast.error("❌ لا يمكن السحب - الرصيد غير كافي");
        return;
      }
      await cashboxService.createTransaction({
        direction: cashType,
        amount: Number(cashAmount),
        type: "manual",
        notes: cashReason,
      });
      toast.success("✅ تم تسجيل حركة الخزنة");
      setShowCashModal(false);
      setCashAmount("");
      setCashReason("");
      loadCashbox(true);
    } catch (e) {
      toast.error("فشل تسجيل العملية");
    }
  }

  function exportVisibleRowsCsv() {
    const headers = ["id", "transaction_no", "date", "direction", "type", "amount", "payment_method", "reference_no", "notes"];
    const csvRows = [
      headers.join(","),
      ...visibleRows.map(row => headers.map(key => JSON.stringify(String(row[key] ?? ""))).join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cashbox_report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }

  const handlePrintReceipt = async (txId) => {
    try {
      toast.loading("جاري تجهيز الإيصال...", { id: "print-tx" });
      const response = await api.get(`/cashbox/transactions/${txId}/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt_TX_${txId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("تم تحميل الإيصال", { id: "print-tx" });
    } catch (error) {
      console.error("Print receipt error:", error);
      toast.error("فشل توليد الإيصال", { id: "print-tx" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-6 text-accent">
          <div className="relative">
            <Wallet className="h-16 w-16 animate-pulse opacity-20" />
            <RefreshCw className="absolute inset-0 m-auto h-8 w-8 animate-spin" />
          </div>
          <p className="text-lg font-black text-main animate-pulse">جاري مزامنة بيانات الخزنة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-24 erp-page-container" dir="rtl">
      {/* 🚀 Header Section: Executive Look */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-border/40 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-main leading-none">خزينة المحل</h1>
              <p className="text-sm font-bold text-muted mt-1 uppercase tracking-widest opacity-60">Financial Management System</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => { setCashType("in"); setShowCashModal(true); }}
            className="h-14 rounded-2xl px-8 font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 gap-2 transition-transform hover:scale-[1.02]"
          >
            <ArrowUpCircle size={20} /> إيداع سريع
          </Button>
          <Button
            onClick={() => { setCashType("out"); setShowCashModal(true); }}
            className="h-14 rounded-2xl px-8 font-black bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 gap-2 transition-transform hover:scale-[1.02]"
          >
            <ArrowDownCircle size={20} /> سحب نقدي
          </Button>
          <Button
            variant="outline"
            onClick={() => loadCashbox(true)}
            disabled={refreshing}
            className="h-14 w-14 rounded-2xl border-2 flex items-center justify-center"
          >
            <RefreshCw size={22} className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* 📊 Summary Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[32px] border-none bg-[#1B1714] text-white p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-none">الرصيد المتاح</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">Current Balance</p>
              <h2 className="text-3xl font-black">{formatCurrency(summary.cash_balance)}</h2>
            </div>
          </div>
        </Card>

        <Card className="rounded-[32px] border border-border/40 bg-card p-8 shadow-soft group hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Deposits</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-emerald-600">إجمالي الداخل</p>
            <h2 className="text-2xl font-black text-main group-hover:text-emerald-600 transition-colors">{formatCurrency(summary.total_in)}</h2>
          </div>
        </Card>

        <Card className="rounded-[32px] border border-border/40 bg-card p-8 shadow-soft group hover:border-red-500/30 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
              <ArrowDownCircle className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Total Withdrawals</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-red-600">إجمالي الخارج</p>
            <h2 className="text-2xl font-black text-main group-hover:text-red-600 transition-colors">{formatCurrency(summary.total_out)}</h2>
          </div>
        </Card>

        <Card className="rounded-[32px] border border-border/40 bg-card p-8 shadow-soft group hover:border-accent/30 transition-colors">
          <div className="flex items-center justify-between mb-8">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
              <PieChart className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Today's Net</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-accent">صافي اليوم</p>
            <h2 className="text-2xl font-black text-main group-hover:text-accent transition-colors">{formatCurrency(summary.today_net)}</h2>
          </div>
        </Card>
      </div>

      {/* 🔍 Advanced Control Center */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-10">
        <aside className="space-y-6">
          <Card className="rounded-[28px] border-none bg-soft/50 p-6 shadow-none">
            <h3 className="text-sm font-black text-main mb-6 flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent" /> وحدة التصفية الذكية
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">بحث نصي شامل</label>
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="رقم العملية، مرجع، ملاحظات..."
                    className="h-12 pr-12 rounded-xl bg-card border-none shadow-soft font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">النطاق الزمني</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 rounded-xl bg-card border-none text-xs" />
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 rounded-xl bg-card border-none text-xs" />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 mb-3 block">فرز حسب الحالة</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "الكل", color: "bg-main text-white" },
                    { id: "today", label: "اليوم", color: "bg-accent/10 text-accent border border-accent/20" },
                    { id: "voided", label: "الملغاة", color: "bg-red-500/10 text-red-500 border border-red-500/20" },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setQuickFilter(btn.id)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${quickFilter === btn.id ? btn.color : "bg-card text-muted hover:bg-white"}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border/40">
                <Button 
                  variant="outline" 
                  onClick={exportVisibleRowsCsv} 
                  className="w-full h-12 rounded-xl border-2 font-black gap-2 hover:bg-main hover:text-white transition-colors"
                >
                  <Download size={18} /> تصدير سجل العمليات (CSV)
                </Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-none bg-accent/5 p-8 relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl -mr-12 -mb-12" />
            <h3 className="text-xs font-black text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldCheck size={16} /> نظام الحماية المالية
            </h3>
            <p className="text-[11px] font-bold text-muted leading-relaxed">
              كافة العمليات مشفرة ومسجلة بسجلات الرقابة الأمنية. لا يمكن حذف أي حركة مالية، بل يتم إلغاؤها فقط لضمان النزاهة.
            </p>
          </Card>
        </aside>

        {/* 📋 Transactions Journal */}
        <div className="space-y-6">
          {/* Custom Tabs */}
          <div className="flex items-center gap-4 bg-soft/50 p-2 rounded-2xl w-fit">
            {[
              { id: "all", label: "كافة الحركات", icon: ArrowRightLeft },
              { id: "in", label: "عمليات الإيداع", icon: ArrowUpCircle },
              { id: "out", label: "عمليات السحب", icon: ArrowDownCircle },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all ${activeTab === tab.id ? "bg-white text-accent shadow-premium" : "text-muted hover:text-main"}`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>

          <Card className="rounded-[32px] border-none shadow-soft bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-soft/40">
                    <th className="px-6 py-5 text-right text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/40">رقم العملية</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/40">التصنيف والمرجع</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/40">طريقة الدفع</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/40">التاريخ والوقت</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/40">القيمة المالية</th>
                    <th className="px-6 py-5 text-center text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/40">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  <AnimatePresence mode="popLayout">
                    {visibleRows.map((row) => {
                      const isIn = row.direction === "in";
                      const isVoided = Number(row.is_voided || 0) === 1;
                      const isManual = row.type?.includes("manual");
                      return (
                        <motion.tr
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          key={row.id}
                          className={`group hover:bg-soft/30 transition-colors ${isVoided ? "opacity-40" : ""}`}
                        >
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                                {isIn ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                              </div>
                              <span className="text-sm font-black text-main">{row.transaction_no || `#${row.id}`}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-main">{TYPE_LABELS[row.type] || row.type}</span>
                                {isVoided && <Badge variant="danger" className="text-[8px] h-4">ملغاة</Badge>}
                              </div>
                              <p className="text-[10px] font-medium text-muted flex items-center gap-1 opacity-70">
                                {row.reference_no ? <>مرجع: <span className="text-accent">{row.reference_no}</span></> : (row.notes ? `"${row.notes.slice(0, 30)}..."` : "بدون ملاحظات")}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <Badge variant="outline" className="rounded-lg border-2 text-[10px] font-black px-3">{row.payment_method || "cash"}</Badge>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
                              <Clock size={12} /> {formatDateTime(row.transaction_date || row.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-6 text-left">
                            <div className={`text-lg font-black ${isVoided ? "line-through text-muted" : (isIn ? "text-emerald-600" : "text-red-600")}`}>
                              {isIn ? "+" : "-"}{formatCurrency(row.amount)}
                            </div>
                          </td>
                          <td className="px-6 py-6 text-center">
                            {isManual && !isVoided && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePrintReceipt(row.id)}
                                className="h-9 w-9 rounded-xl text-accent hover:bg-accent/10"
                                title="طباعة إيصال استلام"
                              >
                                <Printer size={16} />
                              </Button>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {visibleRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-40 text-center bg-card">
                <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center mb-6">
                  <Activity size={32} className="text-muted opacity-30" />
                </div>
                <h3 className="text-xl font-black text-main">لا توجد سجلات مالية</h3>
                <p className="text-sm text-muted mt-2 max-w-xs mx-auto font-bold opacity-60">
                  لم يتم العثور على أي حركات مالية مطابقة لفلاتر البحث الحالية.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 💳 Modal: Professional Manual Transaction */}
      <AnimatePresence>
        {showCashModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCashModal(false)} className="absolute inset-0 bg-[#1B1714]/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-lg">
              <Card className="rounded-[40px] border-none shadow-2xl overflow-hidden bg-card p-0">
                <div className={`h-3 w-full ${cashType === "in" ? "bg-emerald-500" : "bg-red-500"}`} />
                <div className="p-10 space-y-8">
                  <div className="text-center space-y-2">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${cashType === "in" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                      {cashType === "in" ? <ArrowUpCircle size={32} /> : <ArrowDownCircle size={32} />}
                    </div>
                    <h2 className="text-3xl font-black text-main">{cashType === "in" ? "إيداع نقدي جديد" : "سحب نقدي جديد"}</h2>
                    <p className="text-sm font-bold text-muted opacity-60">أدخل البيانات المالية بعناية ليتم تسجيلها في السجل الرسمي</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-muted uppercase tracking-[0.2em] mr-2">المبلغ المالي (EGP)</label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                          className="h-20 text-4xl font-black text-center rounded-[24px] border-2 border-border/40 focus:border-accent bg-soft/30"
                          autoFocus
                        />
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-muted/30">ج.م</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-muted uppercase tracking-[0.2em] mr-2">ملاحظات العملية</label>
                      <textarea
                        placeholder="اكتب هنا تفاصيل الحركة المالية (مثال: دفع فاتورة كهرباء، عهدة...)"
                        value={cashReason}
                        onChange={(e) => setCashReason(e.target.value)}
                        className="w-full h-32 rounded-[24px] border-2 border-border/40 p-6 text-base font-bold focus:border-accent bg-soft/30 outline-none resize-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <Button variant="ghost" onClick={() => setShowCashModal(false)} className="h-16 rounded-[22px] font-black text-muted">إلغاء الأمر</Button>
                    <Button
                      variant={cashType === "in" ? "primary" : "danger"}
                      onClick={handleCreateCash}
                      disabled={!cashAmount || Number(cashAmount) <= 0}
                      className={`h-16 rounded-[22px] font-black text-lg shadow-lg ${cashType === "in" ? "shadow-emerald-500/20" : "shadow-red-500/20"}`}
                    >
                      تأكيد العملية
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
