import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Users,
  CalendarDays,
  Receipt,
  Boxes,
  Zap,
  PlusCircle,
  Clock,
  TrendingUp,
  Wallet,
  ArrowRight,
  Coins,
  UserCheck,
  Search,
  Eye,
  Printer,
  ShieldCheck,
  X,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/services/api";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { formatCurrency, cn } from "@/lib/core/utils";
import {
  PageHeader,
  PremiumCard,
  StatCard,
  ContentPanel,
} from "@/components/shared/PremiumUI";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { printThermalReceipt } from "@/lib/print/receipt";
import { useSalon } from "@/context/SalonContext";
import { toast } from "react-hot-toast";
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
import { Input } from "@/components/ui/input";

export default function CashierDashboard() {
  const { user } = useAuth();
  const { settings } = useSalon();
   
  const { socket } = (useSocket() as any);
  const navigate = useNavigate();

   
  const [summary, setSummary] = useState<any>(null);
   
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Modals State
   
  const [viewInvoice, setViewInvoice] = useState<any>({ open: false, data: null });
   
  const [adjInvoice, setAdjInvoice] = useState<any>({ open: false, data: null });
   
  const [adjForm, setAdjForm] = useState<any>({
    type: "discount",
    reason: "",
    newValue: "",
    managerPin: "",
  });
  const [submittingAdj, setSubmittingAdj] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const [summaryData, todayInvoicesRes] = await Promise.all([
        dashboardService.cashierSummary(),
        api.get("/invoices/today"),
      ]);
      setSummary(summaryData);
      setRecentInvoices(todayInvoicesRes.data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      if (!isRefresh) setError("تعذر تحميل بيانات لوحة التحكم");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // WebSocket: refresh on new invoice or appointment changes
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          msg.event === "invoice_created" ||
          msg.event === "appointment_ready_for_payment" ||
          msg.event === "appointment_status_changed"
        ) {
          loadData(true);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };
    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, loadData]);

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, "gi");
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-primary/20 text-primary font-black rounded-sm px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const filteredTodayInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return recentInvoices;
    return recentInvoices.filter(
      (inv) =>
        (inv.invoice_no || "").toLowerCase().includes(term) ||
        (inv.customer_name || "").toLowerCase().includes(term) ||
        (inv.barber_name || "").toLowerCase().includes(term),
    );
  }, [recentInvoices, searchTerm]);

  const handleViewInvoice = (invoice) => {
    setViewInvoice({ open: true, data: invoice });
  };

  const handlePrintInvoice = async (invoice) => {
    try {
      await printThermalReceipt(invoice, settings);
      toast.success("تم إرسال الفاتورة للطابعة");
    } catch (err) {
      console.error(err);
      toast.error("فشل في طباعة الفاتورة");
    }
  };

  const handleRequestAdjustment = (invoice) => {
    setAdjInvoice({ open: true, data: invoice });
    setAdjForm({ type: "discount", reason: "", newValue: "", managerPin: "" });
  };

  const submitAdjustment = async () => {
    if (!adjForm.reason) return toast.error("يرجى ذكر سبب التعديل");
    setSubmittingAdj(true);
    try {
      const payload = {
        request_type: adjForm.type,
        reason: adjForm.reason,
        notes: "",
        manager_pin: adjForm.managerPin,
        requested_values:
          adjForm.type === "void"
            ? { status: "cancelled" }
            : { new_value: adjForm.newValue },
      };
      await api.post(
        `/invoices/${adjInvoice.data.id}/adjustment-requests`,
        payload,
      );
      toast.success("تم إرسال طلب التعديل بنجاح");
      setAdjInvoice({ open: false, data: null });
      loadData();
    } catch (_err) {
      toast.error("فشل في إرسال الطلب");
    } finally {
      setSubmittingAdj(false);
    }
  };

  const quickActions = [
    {
      title: "نقطة البيع",
      desc: "فتح واجهة الكاشير",
      icon: Zap,
      link: "/pos",
      variant: "primary",
    },
    {
      title: "حجز جديد",
      desc: "تسجيل موعد",
      icon: PlusCircle,
      link: "/bookings",
      variant: "info",
    },
    {
      title: "العملاء",
      desc: "إدارة البيانات",
      icon: Users,
      link: "/customers",
      variant: "success",
    },
    {
      title: "المخزن",
      desc: "متابعة المنتجات",
      icon: Boxes,
      link: "/inventory",
      variant: "warning",
    },
    {
      title: "المصروفات",
      desc: "تسجيل نثريات",
      icon: Coins,
      link: "/expenses",
      variant: "danger",
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Zap className="h-10 w-10 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            جاري تحضير مصفوفة الكاشير...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page space-y-8 pb-12" dir="rtl">
      <PageHeader className={undefined}
        title={`أهلاً بك، ${user?.full_name || "زميلنا"}`}
        subtitle={`آخر تحديث: ${lastRefresh.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`}
        badge="لوحة الكاشير"
        icon={Zap}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="h-9 w-9 rounded-xl"
              title="تحديث البيانات"
            >
              <RefreshCw
                size={16}
                className={cn(refreshing && "animate-spin")}
              />
            </Button>
            <Badge
              variant={summary?.has_open_shift ? "success" : "warning"}
              className="h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider"
            >
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full ml-2",
                  summary?.has_open_shift
                    ? "bg-white animate-pulse"
                    : "bg-white",
                )}
              />
              {summary?.has_open_shift ? "الوردية نشطة" : "الوردية مغلقة"}
            </Badge>
            {!summary?.has_open_shift && (
              <Button
                onClick={() => navigate("/pos")}
                className="h-10 rounded-xl px-6 premium-button"
              >
                بدء وردية العمل
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 overflow-hidden">
        <StatCard
          label="مبيعات اليوم"
          value={formatCurrency(summary?.today_sales || 0)}
          icon={TrendingUp}
          variant="success"
          delay={0}
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="مصاريف اليوم"
          value={formatCurrency(summary?.today_expenses || 0)}
          icon={Coins}
          variant="danger"
          delay={0.05}
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="الموظفون الحاضرون"
          value={summary?.present_employees_count || 0}
          icon={UserCheck}
          variant="primary"
          delay={0.1}
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="بانتظار الخدمة"
          value={summary?.waiting_customers || 0}
          icon={Clock}
          variant="warning"
          delay={0.15}
         trend={undefined} trendValue={undefined} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden">
        <StatCard
          label="الحجوزات"
          value={summary?.today_appointments || 0}
          icon={CalendarDays}
          variant="info"
          delay={0}
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="الفواتير"
          value={summary?.invoices_count || 0}
          icon={Receipt}
          variant="secondary"
          delay={0.05}
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="إلغاءات اليوم"
          value={summary?.todayCancellationsCount || 0}
          icon={X}
          variant="danger"
          delay={0.1}
         trend={undefined} trendValue={undefined} />
        <StatCard
          label="معدل الإلغاء"
          value={`${summary?.cancellationRate || 0}%`}
          icon={TrendingUp}
          variant="warning"
          delay={0.15}
         trend={undefined} trendValue={undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 overflow-hidden">
            {quickActions.map((action, idx) => (
              <Link key={idx} to={action.link}>
                <PremiumCard
                  delay={idx * 0.05}
                  hoverable={false}
                  className="flex flex-col items-center gap-3 p-4 text-center group h-full"
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                      action.variant === "primary"
                        ? "bg-primary-soft text-primary"
                        : action.variant === "success"
                          ? "bg-success-soft text-success"
                          : action.variant === "info"
                            ? "bg-info-soft text-info"
                            : action.variant === "warning"
                              ? "bg-warning-soft text-warning"
                              : "bg-danger-soft text-danger",
                    )}
                  >
                    <action.icon size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-main">
                      {action.title}
                    </p>
                    <p className="text-[9px] font-bold text-muted uppercase">
                      {action.desc}
                    </p>
                  </div>
                </PremiumCard>
              </Link>
            ))}
          </div>

          <ContentPanel className={undefined}
            title="إدارة مبيعات اليوم"
            subtitle="متابعة وتعديل فواتير اليوم بشكل سريع"
            actions={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
                    size={14}
                  />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="بحث برقم الفاتورة أو العميل..."
                    className="pr-9 h-9 text-[11px] font-bold"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/invoices")}
                  className="text-[10px] font-black uppercase"
                >
                  الأرشيف <ArrowRight size={14} className="mr-2 rotate-180" />
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="h-10 text-[10px] font-black uppercase">
                      رقم الفاتورة
                    </TableHead>
                    <TableHead className="h-10 text-[10px] font-black uppercase">
                      العميل
                    </TableHead>
                    <TableHead className="h-10 text-[10px] font-black uppercase">
                      القيمة
                    </TableHead>
                    <TableHead className="h-10 text-[10px] font-black uppercase text-center">
                      الدفع
                    </TableHead>
                    <TableHead className="h-10 text-[10px] font-black uppercase text-center">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTodayInvoices.length > 0 ? (
                    filteredTodayInvoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="hover:bg-soft/50 transition-colors group"
                      >
                        <TableCell className="py-3 font-black text-main tabular-nums text-xs">
                          #{highlightText(inv.invoice_no || inv.id, searchTerm)}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-bold text-muted">
                          {highlightText(
                            inv.customer_name || "عميل عام",
                            searchTerm,
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs font-black text-primary tabular-nums">
                          {formatCurrency(inv.total_amount)}
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <Badge
                            variant="secondary"
                            className="text-[8px] h-4 px-1.5 uppercase font-black"
                          >
                            {inv.payment_method === "cash" ? "نقدي" : "شبكة"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 hover:text-primary"
                              onClick={() => handleViewInvoice(inv)}
                            >
                              <Eye size={14} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 hover:text-primary"
                              onClick={() => handlePrintInvoice(inv)}
                            >
                              <Printer size={14} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 hover:text-warning"
                              onClick={() => handleRequestAdjustment(inv)}
                            >
                              <ShieldCheck size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center opacity-50"
                      >
                        <Receipt
                          size={32}
                          className="mx-auto text-muted mb-2"
                        />
                        <p className="text-[10px] font-black uppercase tracking-widest">
                          لا توجد فواتير مطابقة
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ContentPanel>
        </div>

        <div className="space-y-6">
          <PremiumCard
            className="bg-gradient-to-br from-primary to-primary-strong text-white border-none shadow-xl relative overflow-hidden group"
            hoverable={false}
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 bg-white/10 rounded-full blur-2xl transition-all group-hover:scale-150" />
            <div className="absolute -left-8 -bottom-8 h-24 w-24 bg-white/5 rounded-full blur-xl" />
            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Wallet size={20} />
                </div>
                <Badge
                  variant="outline"
                  className="text-white border-white/30 text-[9px] font-black"
                >
                  تحصيل اليوم
                </Badge>
              </div>
              <div>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  إجمالي النقدية والشبكة
                </p>
                <h2 className="text-3xl font-black mt-1 tracking-tight">
                  {formatCurrency(summary?.today_sales || 0)}
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/10">
                <div className="text-center">
                  <p className="text-[9px] font-bold opacity-70">الفواتير</p>
                  <p className="text-sm font-black">
                    {summary?.invoices_count || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold opacity-70">العملاء</p>
                  <p className="text-sm font-black">
                    {summary?.customers_count || 0}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold opacity-70">الوردية</p>
                  <p className="text-sm font-black">
                    #{summary?.current_shift_id || "---"}
                  </p>
                </div>
              </div>
            </div>
          </PremiumCard>

          <ContentPanel title="تنبيهات المخزون" subtitle={undefined} actions={undefined} className={undefined}>
            {summary?.low_stock_count > 0 ? (
              <div className="rounded-xl bg-warning-soft p-4 border border-warning/20">
                <p className="text-[11px] font-bold leading-relaxed text-warning-strong">
                  هناك {summary.low_stock_count} أصناف وصلت للحد الأدنى.
                </p>
                <Link to="/inventory">
                  <Button
                     
                    variant={("link" as any)}
                    className="p-0 h-auto text-[11px] font-black text-warning-strong underline mt-2"
                  >
                    مراجعة النواقص الآن
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <Boxes size={32} className="mx-auto text-muted/30 mb-2" />
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                  المخزون مستقر
                </p>
              </div>
            )}
          </ContentPanel>
        </div>
      </div>

      {/* View Invoice Modal */}
      <Dialog
        open={viewInvoice.open}
        onOpenChange={(open) => setViewInvoice({ open, data: null })}
      >
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              تفاصيل الفاتورة #{viewInvoice.data?.invoice_no || "---"}
            </DialogTitle>
          </DialogHeader>
          {viewInvoice.data && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-soft p-4 border border-border">
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                    العميل
                  </p>
                  <p className="font-black text-main">
                    {viewInvoice.data.customer_name || "عميل عام"}
                  </p>
                </div>
                <div className="rounded-xl bg-soft p-4 border border-border">
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                    وسيلة الدفع
                  </p>
                  <p className="font-black text-main">
                    {viewInvoice.data.payment_method === "cash"
                      ? "نقدي"
                      : "شبكة"}
                  </p>
                </div>
                <div className="rounded-xl bg-soft p-4 border border-border">
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">
                    الإجمالي
                  </p>
                  <p className="text-xl font-black text-primary tabular-nums">
                    {formatCurrency(viewInvoice.data.total_amount)}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">
                  البنود
                </h4>
                <div className="rounded-2xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-soft/30">
                      <TableRow>
                        <TableHead className="text-[10px]">البند</TableHead>
                        <TableHead className="text-[10px] text-center">
                          الكمية
                        </TableHead>
                        <TableHead className="text-[10px] text-left">
                          السعر
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewInvoice.data.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-bold text-main">
                            {item.service_name}
                          </TableCell>
                          <TableCell className="text-center text-xs font-black tabular-nums">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-left text-xs font-black text-main tabular-nums">
                            {formatCurrency(item.total_price)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewInvoice({ open: false, data: null })}
              className="h-11 rounded-xl px-6"
            >
              إغلاق
            </Button>
            <Button
              onClick={() => handlePrintInvoice(viewInvoice.data)}
              className="h-11 rounded-xl px-6 premium-button"
            >
              <Printer size={16} className="ml-2" /> طباعة إيصال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Request Modal */}
      <Dialog
        open={adjInvoice.open}
        onOpenChange={(open) => setAdjInvoice({ open, data: null })}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              طلب تعديل مالي
            </DialogTitle>
            <DialogDescription className="text-[11px] font-bold text-muted">
              سيتم إرسال هذا الطلب للمراجعة والاعتماد من قبل الإدارة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 p-1">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                نوع التعديل
              </label>
              <Select
                value={adjForm.type}
                onValueChange={(v) => setAdjForm((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger className="font-black h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount" className="font-bold">
                    تعديل الخصم
                  </SelectItem>
                  <SelectItem value="payment_method" className="font-bold">
                    تغيير طريقة الدفع
                  </SelectItem>
                  <SelectItem value="void" className="font-bold">
                    إلغاء الفاتورة بالكامل
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                سبب التعديل
              </label>
              <textarea
                className="w-full h-24 rounded-xl bg-soft p-4 text-sm font-bold border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted/40"
                placeholder="يرجى كتابة تفاصيل السبب..."
                value={adjForm.reason}
                onChange={(e) =>
                  setAdjForm((p) => ({ ...p, reason: e.target.value }))
                }
              />
            </div>
            {adjForm.type !== "void" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  القيمة الجديدة
                </label>
                <Input
                  value={adjForm.newValue}
                  onChange={(e) =>
                    setAdjForm((p) => ({ ...p, newValue: e.target.value }))
                  }
                  placeholder="أدخل المبلغ الجديد..."
                  className="text-center font-black h-11"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                كود المدير (اعتماد فوري)
              </label>
              <Input
                type="password"
                value={adjForm.managerPin}
                onChange={(e) =>
                  setAdjForm((p) => ({ ...p, managerPin: e.target.value }))
                }
                className="text-center tracking-[1em] font-black h-11"
                placeholder="••••"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-6">
            <Button
              variant="ghost"
              onClick={() => setAdjInvoice({ open: false, data: null })}
              className="h-11 rounded-xl"
            >
              تراجع
            </Button>
            <Button
              variant="warning"
              loading={submittingAdj}
              onClick={submitAdjustment}
              className="h-11 rounded-xl px-8 font-black"
            >
              تأكيد وإرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
