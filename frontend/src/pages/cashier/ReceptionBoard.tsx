import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  RefreshCw,
  Phone,
  User,
  Zap,
  UserPlus,
  UserCheck,
  Play,
  Search,
  Check,
  Scissors,
  Sparkles,
  Star,
  History,
  TrendingUp,
  Monitor,
  Wallet,
  AlertCircle,
  ChevronLeft,
  ArrowUpRight,
  X,
  Edit3,
  Trash2,
  Timer,
  GripVertical,
  CalendarDays,
  Wifi,
  WifiOff,
  CheckCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useSocket } from "@/context/SocketContext";
import {
  useAppointments,
  useEmployees,
  useServices,
  useServiceCategories,
  useUpdateAppointmentStatus,
  useAssignBarber,
  QUERY_KEYS,
} from "@/hooks/useAppointments";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTime12h, formatCurrency, cn } from "@/lib/core/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";

const COLUMNS = [
  {
    key: "waiting",
    title: "قائمة الانتظار",
    desc: "بانتظار دورهم أو تأكيد حضورهم",
    icon: Clock,
    statuses: ["waiting", "pending", "confirmed"],
    targetStatus: "waiting",
    theme: {
      text: "text-amber-600 dark:text-amber-400",
      headerBg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-200 dark:border-amber-500/20",
      iconBg:
        "bg-white text-amber-500 dark:bg-white/5 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20",
      count: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
      dot: "bg-amber-500",
      dropRing: "ring-amber-500/40",
    },
  },
  {
    key: "in_service",
    title: "قيد الخدمة",
    desc: "عملاء يتلقون خدماتهم حالياً",
    icon: Scissors,
    statuses: ["in_progress"],
    targetStatus: "in_progress",
    theme: {
      text: "text-indigo-600 dark:text-indigo-400",
      headerBg: "bg-indigo-50 dark:bg-indigo-500/10",
      border: "border-indigo-200 dark:border-indigo-500/20",
      iconBg:
        "bg-white text-indigo-500 dark:bg-white/5 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20",
      count: "bg-indigo-500 text-white shadow-sm shadow-indigo-500/30",
      dot: "bg-indigo-500",
      dropRing: "ring-indigo-500/40",
    },
  },
  {
    key: "review",
    title: "المراجعة المالية",
    desc: "بانتظار مراجعة الفاتورة النهائية",
    icon: Sparkles,
    statuses: ["completed"],
    targetStatus: "completed",
    theme: {
      text: "text-emerald-600 dark:text-emerald-400",
      headerBg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
      iconBg:
        "bg-white text-emerald-500 dark:bg-white/5 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20",
      count: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
      dot: "bg-emerald-500",
      dropRing: "ring-emerald-500/40",
    },
  },
  {
    key: "cashier",
    title: "صندوق الدفع",
    desc: "بانتظار العميل عند الكاشير",
    icon: Wallet,
    statuses: ["ready_for_payment"],
    targetStatus: "ready_for_payment",
    theme: {
      text: "text-sky-600 dark:text-sky-400",
      headerBg: "bg-sky-50 dark:bg-sky-500/10",
      border: "border-sky-200 dark:border-sky-500/20",
      iconBg:
        "bg-white text-sky-500 dark:bg-white/5 dark:text-sky-400 border border-sky-200/60 dark:border-sky-500/20",
      count: "bg-sky-500 text-white shadow-sm shadow-sky-500/30",
      dot: "bg-sky-500",
      dropRing: "ring-sky-500/40",
    },
  },
];

const EmptyState = ({ icon: Icon, title, desc }: any) => (
  <div className="flex flex-col items-center justify-center h-32 sm:h-40 text-center p-4 sm:p-6 border-2 border-dashed border-border/40 rounded-2xl sm:rounded-3xl bg-soft/30 opacity-60">
    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center mb-2 sm:mb-3 shadow-sm border border-border/40">
      <Icon size={18} className="text-muted sm:hidden" />
      <Icon size={22} className="hidden text-muted sm:block" />
    </div>
    <h4 className="text-xs sm:text-sm font-black text-main mb-0.5 sm:mb-1 tracking-tight">
      {title}
    </h4>
    <p className="text-[9px] sm:text-xs font-bold text-muted">{desc}</p>
  </div>
);

function getWaitMinutes(appt: Record<string, unknown> | null | undefined, now: number): number | null {
  if (!appt) return null;
  const status = String(appt.status || "").toLowerCase();
  let start: Date | null = null;
  if (status === "in_progress") {
    if (appt.updated_at) start = new Date(String(appt.updated_at));
  } else {
    const dateStr = appt.appointment_date;
    const timeStr = String(appt.appointment_time || "").slice(0, 5);
    if (dateStr && timeStr) start = new Date(`${dateStr}T${timeStr}:00`);
  }
  if (!start || isNaN(start.getTime())) return null;
  return Math.floor((now - start.getTime()) / 60000);
}

function formatWait(mins: number | null | undefined): string | null {
  if (mins == null || mins < 0) return null;
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `منذ ${h} س ${m} د` : `منذ ${h} س`;
}

export default function ReceptionBoard() {
  const navigate = useNavigate();
  const socketCtx = useSocket();
  const socket = socketCtx?.socket ?? null;
  const connected = socketCtx?.connected ?? false;
  const queryClient = useQueryClient();
  const [isFastClientModalOpen, setIsFastClientModalOpen] = useState(false);
   
  const [assigningAppt, setAssigningAppt] = useState<any>(null);
   
  const [cancelAppt, setCancelAppt] = useState<any>(null);
  const [showDone, setShowDone] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [barberFilter, setBarberFilter] = useState("all");
   
  const [draggingId, setDraggingId] = useState<any>(null);
   
  const [dropCol, setDropCol] = useState<any>(null);
  const [now, setNow] = useState(() => Date.now());

   
  const [fastClientData, setFastClientData] = useState<any>({
    phone: "",
    firstName: "",
    serviceIds: [],
    employeeId: "none",
    notes: "",
  });

   
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [activeCategory, setActiveCategory] = useState("الكل");

  const { data: appointments = [], isFetching: appointmentsFetching } =
    useAppointments({ dateFilter: "today" });
  const { data: barbers = [] } = useEmployees();
  const { data: services = [] } = useServices();
  const { data: categories = [] } = useServiceCategories();

  const statusMutation = useUpdateAppointmentStatus();
  const assignMutation = useAssignBarber();

  const loading = appointmentsFetching && appointments.length === 0;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event?.startsWith("appointment_")) {
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.appointments,
          });
        }
      } catch (_err) {
        // ignore non-JSON socket messages
      }
    };
    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ((fastClientData.phone ?? "").length >= 10) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          setIsSearchingCustomer(true);
          const res = await api.get(
            `/customers/search?phone=${fastClientData.phone}`,
          );
          const customerData = Array.isArray(res.data) ? res.data[0] : res.data;
          if (customerData && customerData.first_name) {
            setFoundCustomer(customerData);
            setFastClientData((prev) => ({
              ...prev,
              firstName: customerData.first_name ?? prev.firstName ?? "",
            }));
            toast.success(`تم العثور على العميل: ${customerData.first_name}`, {
              icon: "👋",
            });
          } else {
            setFoundCustomer(null);
          }
        } catch (_error) {
          setFoundCustomer(null);
        } finally {
          setIsSearchingCustomer(false);
        }
      }, 700);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setFoundCustomer(null);
    }
  }, [fastClientData.phone]);

  const q = searchTerm.trim().toLowerCase();

  const filteredAppointments = useMemo(() => {
    const list = appointments || [];
    if (!q && barberFilter === "all") return list;
    return list.filter((a) => {
      if (barberFilter !== "all" && String(a.barber_id) !== barberFilter)
        return false;
      if (q) {
        const hay =
          `${a.customer_name || ""} ${a.customer_phone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, q, barberFilter]);

  const waitingList = useMemo(
    () =>
      filteredAppointments.filter((a) =>
        ["waiting", "pending", "confirmed"].includes(a.status?.toLowerCase()),
      ),
    [filteredAppointments],
  );
  const inServiceList = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status?.toLowerCase() === "in_progress",
      ),
    [filteredAppointments],
  );
  const reviewList = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status?.toLowerCase() === "completed",
      ),
    [filteredAppointments],
  );
  const atCashierList = useMemo(
    () =>
      filteredAppointments.filter(
        (a) => a.status?.toLowerCase() === "ready_for_payment",
      ),
    [filteredAppointments],
  );
  const doneList = useMemo(
    () =>
      filteredAppointments.filter((a) =>
        ["done"].includes(a.status?.toLowerCase()),
      ),
    [filteredAppointments],
  );

  const kpis = useMemo(() => {
    const all = appointments || [];
    const active = all.filter((a) => a.status?.toLowerCase() !== "cancelled");
    const done = all.filter((a) => a.status?.toLowerCase() === "done");
    const revenue = done.reduce(
      (sum, a) => sum + Number(a.total_estimated_price || 0),
      0,
    );
    return {
      total: active.length,
      waiting: active.filter((a) =>
        ["waiting", "pending", "confirmed"].includes(a.status?.toLowerCase()),
      ).length,
      inService: active.filter((a) => a.status?.toLowerCase() === "in_progress")
        .length,
      cashier: active.filter(
        (a) => a.status?.toLowerCase() === "ready_for_payment",
      ).length,
      done: done.length,
      revenue,
    };
  }, [appointments]);

  const filteredServices = useMemo(() => {
    if (activeCategory === "الكل") return services;
    return services.filter(
      (s) =>
        s.category_name === activeCategory ||
        String(s.category_id) === String(activeCategory),
    );
  }, [services, activeCategory]);

  const toggleService = (serviceId) => {
    setFastClientData((prev) => {
      const exists = prev.serviceIds.includes(serviceId);
      if (exists) {
        return {
          ...prev,
          serviceIds: prev.serviceIds.filter((id) => id !== serviceId),
        };
      } else {
        return { ...prev, serviceIds: [...prev.serviceIds, serviceId] };
      }
    });
  };

  const totalPrice = useMemo(() => {
    return fastClientData.serviceIds.reduce((sum, id) => {
      const s = services.find((srv) => srv.id === id);
      return sum + (s ? Number(s.price) : 0);
    }, 0);
  }, [fastClientData.serviceIds, services]);

  const totalDuration = useMemo(() => {
    return fastClientData.serviceIds.reduce((sum, id) => {
      const s = services.find((srv) => srv.id === id);
      return sum + (s ? s.duration_minutes || 30 : 0);
    }, 0);
  }, [fastClientData.serviceIds, services]);

  const handleEdit = (appt) => {
    navigate("/bookings", { state: { editAppointment: appt } });
  };

  const handleUpdateStatus = async (apptId, newStatus) => {
    try {
      await statusMutation.mutateAsync({ id: apptId, status: newStatus });
      toast.success("تم تحديث الحالة");
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "فشل تحديث الحالة");
    }
  };

  const handleDrop = (apptId, columnKey) => {
    setDropCol(null);
    setDraggingId(null);
    if (!apptId) return;
    const col = COLUMNS.find((c) => c.key === columnKey);
    if (!col) return;
    handleUpdateStatus(apptId, col.targetStatus);
  };

  const handleReassignBarber = async (apptId, barberId) => {
    try {
      await assignMutation.mutateAsync({
        appointmentId: apptId,
        employeeId: barberId,
      });
      toast.success("تم تغيير الخبير بنجاح");
      setAssigningAppt(null);
    } catch (_error) {
      toast.error("فشل تغيير الخبير");
    }
  };

  const confirmCancel = async () => {
    if (!cancelAppt) return;
    try {
      await statusMutation.mutateAsync({
        id: cancelAppt.id,
        status: "cancelled",
      });
      toast.success("تم إلغاء الحجز بنجاح");
      setCancelAppt(null);
    } catch (_error) {
      toast.error("فشل إلغاء الحجز");
    }
  };

  const handleFastClientSubmit = async (e) => {
    e.preventDefault();
    if (!fastClientData.serviceIds.length) {
      toast.error("يرجى اختيار خدمة واحدة على الأقل");
      return;
    }
    if (!fastClientData.phone?.trim() || !fastClientData.firstName?.trim()) {
      toast.error("يرجى إدخال رقم الهاتف واسم العميل");
      return;
    }
    try {
      const payload = {
        phone: String(fastClientData.phone).trim(),
        first_name: String(fastClientData.firstName).trim(),
        service_ids: fastClientData.serviceIds.map((id) => Number(id)),
        employee_id:
          fastClientData.employeeId === "none" || !fastClientData.employeeId
            ? null
            : Number(fastClientData.employeeId),
        notes: fastClientData.notes?.trim() || null,
        booking_source: "shop",
      };
      await api.post("/appointments/fast-walkin", payload);
      toast.success("تم تسجيل العميل بنجاح");
      setIsFastClientModalOpen(false);
      setFastClientData({
        phone: "",
        firstName: "",
        serviceIds: [],
        employeeId: "none",
        notes: "",
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "فشل تسجيل العميل");
    }
  };

  const columnLists = {
    waiting: waitingList,
    in_service: inServiceList,
    review: reviewList,
    cashier: atCashierList,
  };

  return (
    <div className="erp-page-container space-y-6 pb-16 relative" dir="rtl">
      {/* ── HEADER ── */}
      <PageHeader className={undefined}
        title="لوحة التحكم والعمليات"
        subtitle="متابعة دقيقة لمسار العميل داخل الصالون"
        badge={connected ? "متصل مباشر" : "غير متصل"}
        icon={Monitor}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className={cn(
                "hidden lg:flex items-center gap-2 px-3 h-11 rounded-xl border text-[11px] font-black transition-all",
                connected
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
              )}
            >
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connected ? "الاتصال الحي يعمل" : "إعادة الاتصال..."}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              aria-label="تحديث البيانات"
              title="تحديث البيانات"
              className="h-11 w-11 rounded-xl"
            >
              <RefreshCw
                size={18}
                className={appointmentsFetching ? "animate-spin" : ""}
              />
            </Button>
            <Button
              onClick={() => setIsFastClientModalOpen(true)}
              className="h-11 px-8 rounded-xl font-black bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 text-sm"
            >
              <UserPlus size={20} /> تسجيل عميل سريع
            </Button>
          </div>
        }
      />

      {/* ── KPI STATS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        <KpiCard
          label="إجمالي اليوم"
          value={kpis.total}
          icon={CalendarDays}
          className="text-primary bg-primary/10"
        />
        <KpiCard
          label="قيد الانتظار"
          value={kpis.waiting}
          icon={Clock}
          className="text-amber-600 dark:text-amber-400 bg-amber-500/10"
        />
        <KpiCard
          label="قيد الخدمة"
          value={kpis.inService}
          icon={Scissors}
          className="text-indigo-600 dark:text-indigo-400 bg-indigo-500/10"
        />
        <KpiCard
          label="بالصندوق"
          value={kpis.cashier}
          icon={Wallet}
          className="text-sky-600 dark:text-sky-400 bg-sky-500/10"
        />
        <KpiCard
          label="مكتمل اليوم"
          value={kpis.done}
          icon={CheckCheck}
          className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
        />
        <KpiCard
          label="إيراد اليوم"
          value={formatCurrency(kpis.revenue)}
          icon={TrendingUp}
          className="text-success bg-success/10"
        />
      </div>

      {/* ── TOOLBAR ── */}
      <div className="surface-toolbar flex flex-col md:flex-row flex-wrap gap-2 md:items-center justify-between">
        <div className="relative w-full lg:w-auto lg:flex-1 lg:max-w-md min-w-0">
          <Search
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث فوري بالاسم أو الهاتف..."
            className="h-11 pr-11 pl-4 rounded-xl"
            aria-label="بحث في المواعيد"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
              aria-label="مسح البحث"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
          <Select value={barberFilter} onValueChange={setBarberFilter}>
            <SelectTrigger className="h-11 w-full lg:w-52 bg-soft border-border rounded-xl font-bold text-xs">
              <SelectValue placeholder="كل الخبراء" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">
                كل الخبراء
              </SelectItem>
              {barbers.map((b) => (
                <SelectItem
                  key={b.id}
                  value={String(b.id)}
                  className="font-bold"
                >
                  {b.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showDone ? "primary" : "outline"}
            onClick={() => setShowDone((v) => !v)}
            className="h-11 px-4 rounded-xl font-black text-xs flex-1 lg:flex-none"
          >
            <History size={15} className="ml-1" />
            مكتمل اليوم ({doneList.length})
          </Button>
        </div>
      </div>

      {/* ── KANBAN BOARD ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="min-h-[20rem]">
            <BoardColumn
              col={col}
              items={columnLists[col.key]}
              loading={loading}
              now={now}
              draggingId={draggingId}
              dropCol={dropCol}
              setDropCol={setDropCol}
              onDrop={handleDrop}
              onEdit={handleEdit}
              onCancel={setCancelAppt}
              onReassign={setAssigningAppt}
              onUpdateStatus={handleUpdateStatus}
            />
          </div>
        ))}
      </div>

      {/* ── DONE TODAY PANEL ── */}
      <AnimatePresence>
        {showDone && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="rounded-[2rem] border border-border/60 bg-card/60 backdrop-blur-xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-main">مكتمل اليوم</h3>
                  <p className="text-[10px] font-bold text-muted">
                    {doneList.length} عميل تم إنجاز خدمته
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-black rounded-lg px-3 py-1">
                {formatCurrency(kpis.revenue)}
              </Badge>
            </div>
            {doneList.length === 0 ? (
              <EmptyState
                icon={CheckCheck}
                title="لا مكتملة اليوم"
                desc="لم يتم إنهاء أي خدمة حتى الآن."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {doneList.map((a) => (
                  <DoneCard key={a.id} appt={a} />
                ))}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── MODALS ── */}
      <Dialog
        open={isFastClientModalOpen}
        onOpenChange={setIsFastClientModalOpen}
      >
        <DialogContent
          className="sm:max-w-[850px] p-0 border-none bg-card rounded-[2rem] shadow-premium overflow-hidden"
          dir="rtl"
        >
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-gradient-to-br from-accent to-accent-strong relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-white/10 blur-[80px] pointer-events-none" />
            <div className="relative z-10 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-lg">
                  <UserPlus size={24} />
                </div>
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    تسجيل عميل سريع
                  </DialogTitle>
                  <DialogDescription className="text-white/60 font-bold mt-0.5 text-xs">
                    إضافة عميل جديد أو حالي مباشرة إلى مسار العمليات
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={handleFastClientSubmit}
            className="p-4 sm:p-8 space-y-6 bg-card relative flex-1 min-h-0 overflow-y-auto custom-scrollbar"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 lg:gap-10">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-2">
                      <Phone size={12} className="text-accent" /> رقم الهاتف
                    </label>
                    <div className="relative group">
                      <Input
                        placeholder="01xxxxxxxxx"
                        value={fastClientData.phone ?? ""}
                        onChange={(e) =>
                          setFastClientData({
                            ...fastClientData,
                            phone: e.target.value,
                          })
                        }
                        className="h-11 bg-soft border-border focus:bg-white rounded-xl text-right pr-11 font-black transition-all"
                        required
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted">
                        {isSearchingCustomer ? (
                          <RefreshCw
                            size={16}
                            className="animate-spin text-accent"
                          />
                        ) : (
                          <Search size={16} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-2">
                      <User size={12} className="text-accent" /> اسم العميل
                    </label>
                    <Input
                      placeholder="الاسم الثلاثي"
                      value={fastClientData.firstName ?? ""}
                      onChange={(e) =>
                        setFastClientData({
                          ...fastClientData,
                          firstName: e.target.value,
                        })
                      }
                      className="h-11 bg-soft border-border focus:bg-white rounded-xl text-right font-black transition-all"
                      required
                    />
                  </div>
                </div>

                {foundCustomer && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Star size={20} fill="currentColor" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-emerald-600">
                          عميل مميز (VIP)
                        </p>
                        <p className="text-[10px] font-bold text-emerald-500/60">
                          إجمالي {foundCustomer.visits_count} زيارة سابقة للمحل
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500 text-white font-black rounded-lg">
                      بيانات مؤرشفة
                    </Badge>
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2 flex items-center gap-2">
                      <Scissors size={12} className="text-accent" /> اختيار
                      الخدمات المطلوبة
                    </label>
                    <Badge
                      variant="outline"
                      className="border-accent/20 text-accent font-black px-3 py-1 rounded-xl"
                    >
                      {fastClientData.serviceIds.length} خدمات مختارة
                    </Badge>
                  </div>

                  <div className="chip-scroller pb-1">
                    {["الكل", ...categories.map((c) => c.name)].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 whitespace-nowrap",
                          activeCategory === cat
                            ? "bg-accent border-accent text-white shadow-lg shadow-accent/20"
                            : "bg-soft border-transparent text-muted hover:text-accent",
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredServices.map((srv) => {
                      const isSelected = fastClientData.serviceIds.includes(
                        srv.id,
                      );
                      return (
                        <div
                          key={srv.id}
                          onClick={() => toggleService(srv.id)}
                          className={cn(
                            "p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative group overflow-hidden",
                            isSelected
                              ? "bg-accent/5 border-accent shadow-sm"
                              : "bg-soft border-transparent hover:border-border",
                          )}
                        >
                          {isSelected && (
                            <motion.div
                              layoutId="check"
                              className="absolute top-2 left-2 w-5 h-5 bg-accent rounded-full flex items-center justify-center shadow-lg z-10"
                            >
                              <Check
                                size={12}
                                className="text-white"
                                strokeWidth={4}
                              />
                            </motion.div>
                          )}
                          <div className="space-y-1 relative z-10">
                            <p className="font-black text-[13px] text-main group-hover:text-accent transition-colors truncate">
                              {srv.name}
                            </p>
                            <div className="flex justify-between items-center mt-2">
                              <span className="text-xs font-black text-accent tabular-nums">
                                {formatCurrency(srv.price)}
                              </span>
                              <span className="text-[10px] font-bold text-muted flex items-center gap-1">
                                <Clock size={10} /> {srv.duration_minutes || 30}{" "}
                                د
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-soft border border-border/40 rounded-[2rem] p-6 space-y-5 relative overflow-hidden">
                  <div className="space-y-5 relative z-10">
                    <h4 className="text-[11px] font-black text-accent uppercase tracking-widest flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />{" "}
                      ملخص العملية
                    </h4>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-muted">
                          إجمالي الخدمات:
                        </span>
                        <span className="text-sm font-black text-main">
                          {fastClientData.serviceIds.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-muted">
                          الوقت المقدر:
                        </span>
                        <span className="text-sm font-black text-main flex items-center gap-1.5">
                          {totalDuration}{" "}
                          <span className="text-[10px] text-muted font-bold">
                            دقيقة
                          </span>
                        </span>
                      </div>
                      <div className="pt-4 border-t border-border flex flex-col gap-2">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                          الإجمالي المستحق:
                        </span>
                        <motion.span
                          key={totalPrice}
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-3xl font-black text-emerald-600 tabular-nums tracking-tighter"
                        >
                          {formatCurrency(totalPrice)}
                        </motion.span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 pt-5 border-t border-border relative z-10">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        اختيار الخبير
                      </label>
                      <Select
                        value={fastClientData.employeeId}
                        onValueChange={(v) =>
                          setFastClientData({
                            ...fastClientData,
                            employeeId: v,
                          })
                        }
                      >
                        <SelectTrigger className="h-11 bg-white border-border rounded-xl font-bold text-xs">
                          <SelectValue placeholder="اختر خبير" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="font-bold">
                            توزيع تلقائي (الأول متاح)
                          </SelectItem>
                          {barbers.map((b) => (
                            <SelectItem
                              key={b.id}
                              value={String(b.id)}
                              className="font-bold"
                            >
                              {b.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        ملاحظات الكاشير
                      </label>
                      <Input
                        placeholder="أي تفاصيل خاصة..."
                        value={fastClientData.notes ?? ""}
                        onChange={(e) =>
                          setFastClientData({
                            ...fastClientData,
                            notes: e.target.value,
                          })
                        }
                        className="h-11 bg-white border border-border focus:bg-white rounded-xl text-right text-xs font-bold transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={fastClientData.serviceIds.length === 0}
                  className="w-full h-14 rounded-2xl bg-accent hover:bg-accent-strong text-white font-black text-base shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={20} />
                  <span>حفظ وتأكيد تسجيل العميل</span>
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!assigningAppt}
        onOpenChange={() => setAssigningAppt(null)}
      >
        <DialogContent className="sm:max-w-[400px] bg-card border-none text-main rounded-[2rem] shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              تغيير الخبير
            </DialogTitle>
            <DialogDescription className="text-muted font-bold">
              اختر خبيراً آخراً لهذا الموعد
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4 max-h-[300px] overflow-y-auto custom-scrollbar text-right">
            {barbers.map((b) => (
              <Button
                key={b.id}
                variant="outline"
                onClick={() => handleReassignBarber(assigningAppt.id, b.id)}
                className="justify-start gap-4 h-16 rounded-2xl border-border/40 hover:bg-soft hover:border-accent/40 transition-all group flex-row-reverse"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black group-hover:bg-accent group-hover:text-white transition-colors">
                  {b.display_name?.[0]}
                </div>
                <div className="text-right flex-1">
                  <p className="font-black text-sm">{b.display_name}</p>
                  <p className="text-[10px] font-bold text-muted uppercase">
                    {b.job_title || "خبير"}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelAppt} onOpenChange={() => setCancelAppt(null)}>
        <DialogContent className="sm:max-w-[420px] bg-card border-none text-main rounded-[2rem] shadow-premium">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <AlertCircle size={20} className="text-rose-500" />
              تأكيد إلغاء الحجز
            </DialogTitle>
            <DialogDescription className="text-muted font-bold">
              هل أنت متأكد من إلغاء حجز{" "}
              <span className="text-main">
                {cancelAppt?.customer_name || "العميل"}
              </span>
              ؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCancelAppt(null)}
              className="flex-1 h-12 rounded-xl font-black text-xs"
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              className="flex-1 h-12 rounded-xl font-black text-xs"
            >
              <Trash2 size={15} /> تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, className }: any) {
  return (
    <div className="group relative rounded-xl border border-border/60 bg-card p-2.5 sm:p-4 shadow-soft transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
            className,
          )}
        >
          <Icon size={14} className="sm:hidden" />
          <Icon size={18} className="hidden sm:block" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-widest truncate">
            {label}
          </div>
          <div className="text-sm sm:text-lg font-black text-main tabular-nums truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  col,
  items,
  loading,
  now,
  draggingId,
  dropCol,
  setDropCol,
  onDrop,
  onEdit,
  onCancel,
  onReassign,
  onUpdateStatus,
}: any) {
  const isOver = dropCol === col.key;

  const handleDragOver = (e) => {
    e.preventDefault();
    if (dropCol !== col.key) setDropCol(col.key);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-[2rem] border overflow-hidden bg-card/60 backdrop-blur-xl shadow-soft transition-all duration-300 min-h-0",
        col.theme.border,
        isOver && cn("ring-2 ring-inset bg-soft/80", col.theme.dropRing),
      )}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropCol(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        onDrop(id, col.key);
      }}
    >
      {/* Column Header */}
      <div
        className={cn(
          "shrink-0 p-3 sm:p-5 border-b flex items-center justify-between gap-2 sm:gap-3",
          col.theme.headerBg,
          col.theme.border,
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className={cn(
              "p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-sm shrink-0",
              col.theme.iconBg,
            )}
          >
            <col.icon size={14} className="sm:hidden" />
            <col.icon size={16} className="hidden sm:block" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black text-main truncate">
              {col.title}
            </h3>
            <p className="hidden sm:block text-[10px] font-bold text-muted truncate">
              {col.desc}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "rounded-lg px-3 py-1 text-[11px] font-black shrink-0",
            col.theme.count,
          )}
        >
          {items.length}
        </Badge>
      </div>

      {/* Column Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 sm:p-3 space-y-2 sm:space-y-3">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon={col.icon}
            title="القائمة فارغة"
            desc="لا يوجد عملاء في هذه المرحلة حالياً."
          />
        ) : (
          items.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              col={col}
              now={now}
              dragging={draggingId === appt.id}
              onEdit={() => onEdit(appt)}
              onCancel={() => onCancel(appt)}
              onReassign={() => onReassign(appt)}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AppointmentCard({
  appt,
  col,
  now,
  dragging,
  onEdit,
  onCancel,
  onReassign,
  onUpdateStatus,
}: any) {
  const isOnline = appt.booking_source === "online";
  const status = String(appt.status || "").toLowerCase();
  const waitMins = getWaitMinutes(appt, now);
  const waitLabel = formatWait(waitMins);
  const timeLabel = appt.appointment_time
    ? formatTime12h(String(appt.appointment_time).slice(0, 5))
    : "—";

  return (
    <motion.div
      layout
      draggable
      onDragStart={(e) => {
        const dragEvent = e as unknown as React.DragEvent;
        dragEvent.dataTransfer.setData("text/plain", String(appt.id));
        dragEvent.dataTransfer.effectAllowed = "move";
      }}
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        rotate: dragging ? 1.5 : 0,
      }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={{ y: -3 }}
      className={cn(
        "p-3 sm:p-4 bg-card border border-border/60 rounded-xl sm:rounded-[1.5rem] flex flex-col gap-3 sm:gap-4 transition-all duration-300 relative overflow-hidden group shadow-soft hover:shadow-premium hover:border-accent/30 cursor-grab active:cursor-grabbing",
        dragging && "opacity-60 ring-2 ring-accent/30 shadow-2xl",
      )}
    >
      {/* Drag Handle */}
      <div className="absolute top-3 left-3 text-muted/30 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={16} />
      </div>

      {/* Top Row */}
      <div className="flex justify-between items-start gap-3 pt-1">
        <div className="min-w-0 space-y-2 flex-1">
          <h4 className="font-black text-base text-main truncate leading-tight group-hover:text-accent transition-colors">
            {appt.customer_name || "عميل مجهول"}
          </h4>
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted min-w-0">
            <Phone size={12} className="text-muted/60 shrink-0" />
            <span className="truncate" dir="ltr">
              {appt.customer_phone || "غير متوفر"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(appt.services || []).slice(0, 1).map((s, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] font-black text-muted flex items-center gap-1.5 uppercase tracking-tighter bg-soft border-border/40 px-2 py-0.5 rounded-lg"
              >
                <Zap size={10} className="text-accent" />{" "}
                {s.service_name_snapshot || "خدمة عامة"}
              </Badge>
            ))}
            {appt.services?.length > 1 && (
              <Badge
                variant="outline"
                className="text-[9px] font-black text-accent bg-accent/5 border-accent/10 px-1.5 py-0.5 rounded-lg"
              >
                +{appt.services.length - 1} أخرى
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-main bg-soft px-3 py-1 rounded-xl border border-border/40 shadow-sm tabular-nums">
            <Clock size={12} className="text-accent" />
            {timeLabel}
          </div>
          {isOnline && (
            <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[9px] font-black h-5 px-2 rounded-lg border border-sky-500/20 uppercase tracking-widest">
              ONLINE
            </Badge>
          )}
          {waitLabel && (
            <Badge
              className={cn(
                "text-[9px] font-black h-5 px-2 rounded-lg border uppercase tracking-widest",
                (waitMins ?? 0) > 20
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : (waitMins ?? 0) > 10
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
              )}
            >
              <Timer size={10} className="ml-1" />
              {waitLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Barber Row */}
      <div className="flex items-center justify-between p-3 bg-soft/50 rounded-[1.25rem] border border-border/40 group-hover:bg-card group-hover:border-accent/10 transition-all duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          <EmployeeAvatar
            name={appt.barber_name}
            size="sm"
            className="h-8 w-8 shrink-0"
           imageUrl={undefined} role={undefined} />
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted uppercase leading-none mb-1 tracking-widest">
              الخبير
            </p>
            <p
              className="text-xs font-black text-main truncate group-hover:text-accent transition-colors"
              title={appt.barber_name}
            >
              {appt.barber_name || "توزيع تلقائي"}
            </p>
          </div>
        </div>
        <ChevronLeft
          size={14}
          className="text-muted group-hover:text-accent transition-all group-hover:translate-x-[-2px] shrink-0"
        />
      </div>

      {/* Actions */}
      <div className="pt-1 space-y-2.5">
        {col.key === "waiting" &&
          status !== "done" &&
          status !== "cancelled" && (
            <>
              {status === "waiting" ? (
                <Button
                  onClick={() => onUpdateStatus(appt.id, "in_progress")}
                  className="w-full h-11 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-black text-xs hover:scale-[1.02] transition-all"
                >
                  <Play size={15} className="ml-2" fill="currentColor" /> توجيه
                  للخبير
                </Button>
              ) : (
                <Button
                  onClick={() => onUpdateStatus(appt.id, "waiting")}
                  className="w-full h-11 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 font-black text-xs hover:scale-[1.02] transition-all"
                >
                  <UserCheck size={15} className="ml-2" /> تأكيد الوصول
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={onEdit}
                  className="flex-1 h-10 rounded-xl bg-white dark:bg-white/5 text-muted hover:text-primary border border-border/40 transition-all flex items-center justify-center gap-2 text-[11px] font-black"
                >
                  <Edit3 size={13} className="text-primary" /> تعديل
                </Button>
                <Button
                  variant="ghost"
                  onClick={onCancel}
                  className="flex-1 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/10 transition-all flex items-center justify-center gap-2 text-[11px] font-black"
                >
                  <Trash2 size={13} /> إلغاء
                </Button>
              </div>
            </>
          )}

        {col.key === "in_service" && (
          <Button
            onClick={() => onUpdateStatus(appt.id, "completed")}
            className="w-full h-11 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 font-black text-xs hover:scale-[1.02] transition-all"
          >
            <CheckCircle2 size={15} className="ml-2" /> إنهاء وإرسال للاستقبال
          </Button>
        )}

        {col.key === "review" && (
          <Button
            onClick={() => onUpdateStatus(appt.id, "ready_for_payment")}
            className="w-full h-11 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 font-black text-xs hover:scale-[1.02] transition-all"
          >
            تأكيد جاهزية الدفع <ArrowUpRight size={15} className="mr-2" />
          </Button>
        )}

        {col.key === "cashier" && (
          <div className="w-full h-11 rounded-xl bg-sky-500/5 border border-sky-500/20 flex items-center justify-center gap-3">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest">
              قيد التحصيل الآن
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onReassign}
          className="w-full h-10 text-[11px] font-black text-muted hover:text-accent hover:bg-white/5 rounded-xl border border-dashed border-border/40 hover:border-accent/40 transition-all"
        >
          <RefreshCw size={13} className="ml-2" /> تغيير خبير الخدمة
        </Button>
      </div>
    </motion.div>
  );
}

function DoneCard({ appt }: any) {
  return (
    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-500/15 bg-emerald-500/5 flex items-center gap-2 sm:gap-3">
      <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
        <CheckCheck size={12} className="sm:hidden" />
        <CheckCheck size={16} className="hidden sm:block" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs font-black text-main truncate">
          {appt.customer_name || "عميل مجهول"}
        </p>
        <p className="text-[8px] sm:text-[10px] font-bold text-muted truncate">
          {appt.barber_name || "توزيع تلقائي"}
        </p>
      </div>
      <div className="text-left shrink-0">
        <p className="text-[10px] sm:text-xs font-black text-emerald-600 tabular-nums">
          {formatCurrency(appt.total_estimated_price)}
        </p>
        <p className="text-[8px] sm:text-[9px] font-bold text-muted">
          {appt.appointment_time
            ? formatTime12h(String(appt.appointment_time).slice(0, 5))
            : "—"}
        </p>
      </div>
    </div>
  );
}
