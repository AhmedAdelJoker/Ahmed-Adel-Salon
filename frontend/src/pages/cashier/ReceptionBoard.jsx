import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Activity,
  User,
  Clock,
  CheckCircle2,
  RefreshCw,
  Phone,
  Zap,
  UserPlus,
  Play,
  Search,
  Check,
  Scissors,
  Sparkles,
  Ticket,
  Star,
  History,
  TrendingUp,
  ShieldCheck,
  Monitor,
  Wallet,
  AlertCircle,
  Coffee,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api, { baseURL } from "../../services/api";

const STATIC_URL = baseURL.replace("/api/v1", "");
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";

const getBarberAvatarUrl = (barber) => {
  if (!barber?.profile_image_url) return null;
  if (barber.profile_image_url.startsWith("http")) return barber.profile_image_url;
  return `${STATIC_URL}${barber.profile_image_url}`;
};

// مكون فرعي لشاشات "لا يوجد بيانات"
const EmptyState = ({ icon: Icon, title, desc }) => (
  <div className="flex flex-col items-center justify-center h-48 text-center p-6 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/5 opacity-60">
    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
      <Icon size={24} className="text-slate-400" />
    </div>
    <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
    <p className="text-[11px] text-slate-400">{desc}</p>
  </div>
);

// دالة مساعدة لحساب لون التنبيه حسب وقت الانتظار (تخيلي للـ UX)
const getWaitTimeColor = (minutes) => {
  if (minutes > 30) return "text-rose-400 bg-rose-400/10";
  if (minutes > 15) return "text-amber-400 bg-amber-400/10";
  return "text-emerald-400 bg-emerald-400/10";
};

export default function ReceptionBoard() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [appointments, setAppointments] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isFastClientModalOpen, setIsFastClientModalOpen] = useState(false);
  const [assigningAppt, setAssigningAppt] = useState(null);

  const [fastClientData, setFastClientData] = useState({
    phone: "",
    firstName: "",
    serviceId: "",
    employeeId: "none",
  });

  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState("all");
  const [actionLoading, setActionLoading] = useState(null);

  const selectedServicePrice = useMemo(() => {
    if (!fastClientData.serviceId) return 0;
    const service = services.find(
      (s) => String(s.id) === String(fastClientData.serviceId),
    );
    return service ? service.sell_price || service.price || 0 : 0;
  }, [fastClientData.serviceId, services]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [apptsRes, barbersRes, servicesRes, catsRes] = await Promise.all([
        api.get("/appointments?date_filter=today&limit=1000"),
        api.get("/barbers"),
        api.get("/services"),
        api.get("/service-categories"),
      ]);
      const appointmentsPayload = Array.isArray(apptsRes.data?.items)
        ? apptsRes.data.items
        : Array.isArray(apptsRes.data)
          ? apptsRes.data
          : [];
      setAppointments(
        appointmentsPayload.map((appt) => {
          const servicesList = Array.isArray(appt.services) ? appt.services : [];
          const primaryService = servicesList[0];
          const employeeId =
            appt.employee_id ?? appt.barber_id ?? appt.barberId ?? null;
          const employeeName =
            appt.employeeName ||
            appt.employee_name ||
            appt.barber_name ||
            appt.barberName ||
            null;

          return {
            ...appt,
            customerName: appt.customerName || appt.customer_name || "عميل",
            customer_name: appt.customer_name || appt.customerName || "عميل",
            employee_id: employeeId,
            employeeName,
            employee_name: employeeName,
            serviceName:
              appt.serviceName ||
              appt.service_name ||
              primaryService?.service_name_snapshot ||
              primaryService?.name ||
              "خدمة",
          };
        }),
      );
      setBarbers(barbersRes.data || []);
      setServices(
        Array.isArray(servicesRes.data.items)
          ? servicesRes.data.items
          : Array.isArray(servicesRes.data)
            ? servicesRes.data
            : [],
      );
      setCategories(catsRes.data || []);    } catch (error) {
      toast.error("حدث خطأ أثناء تحميل بيانات لوحة الاستقبال");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket || typeof socket.on !== "function") return;
    socket.on("appointments_updated", fetchData);
    socket.on("barber_status_changed", fetchData);
    return () => {
      if (typeof socket.off === "function") {
        socket.off("appointments_updated", fetchData);
        socket.off("barber_status_changed", fetchData);
      }
    };
  }, [socket, fetchData]);

  useEffect(() => {
    if (fastClientData.phone.length < 10) {
      setExistingCustomer(null);
      return;
    }
    const searchCustomer = async () => {
      try {
        setIsSearchingCustomer(true);
        const res = await api.get(
          `/customers/search?phone=${fastClientData.phone}`,
        );
        if (res.data && (res.data.customer_id || res.data.id)) {
          setExistingCustomer(res.data);
          setFastClientData((p) => ({
            ...p,
            firstName: res.data.first_name || "",
          }));
        } else {
          setExistingCustomer(null);
        }
      } catch (err) {
        setExistingCustomer(null);
      } finally {
        setIsSearchingCustomer(false);
      }
    };
    const delayDebounce = setTimeout(() => searchCustomer(), 600);
    return () => clearTimeout(delayDebounce);
  }, [fastClientData.phone]);

  const handleAddFastClient = useCallback(async () => {
    if (
      !fastClientData.phone ||
      !fastClientData.firstName ||
      !fastClientData.serviceId
    ) {
      toast.error("يرجى ملء الحقول المطلوبة (الهاتف، الاسم، والخدمة)");
      return;
    }
    try {
      setActionLoading("adding-fast-client");
      await api.post("/appointments/fast-walkin", {
        phone: fastClientData.phone,
        firstName: fastClientData.firstName,
        serviceId: fastClientData.serviceId,
        employeeId:
          fastClientData.employeeId === "none"
            ? null
            : fastClientData.employeeId,
      });
      toast.success("تم تسجيل العميل بنجاح ودخوله صالة الانتظار");
      setIsFastClientModalOpen(false);
      setFastClientData({
        phone: "",
        firstName: "",
        serviceId: "",
        employeeId: "none",
      });
      setExistingCustomer(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "فشل تسجيل الدخول السريع");
    } finally {
      setActionLoading(null);
    }
  }, [fastClientData, fetchData]);

  const handleAssignBarber = async (apptId, barberId) => {
    try {
      await api.patch(`/appointments/${apptId}/assign-barber`, {
        employee_id: barberId,
      });
      toast.success("تم توجيه المهمة للخبير بنجاح");
      setAssigningAppt(null);
      fetchData();
    } catch (error) {
      toast.error("فشل توجيه المهمة");
    }
  };

  const handleUpdateStatus = async (apptId, newStatus) => {
    try {
      await api.patch(`/appointments/${apptId}/status`, { status: newStatus });
      toast.success("تم تحديث حالة العميل");
      fetchData();
    } catch (error) {
      toast.error("فشل تحديث الحالة");
    }
  };

  const filteredServices = useMemo(() => {
    if (activeCategoryTab === "all") return services;
    return services.filter(
      (s) => String(s.category_id) === String(activeCategoryTab),
    );
  }, [services, activeCategoryTab]);

  const getBarberStatusInModal = (barberId) => {
    const activeJobs = appointments.filter(
      (a) =>
        String(a.employee_id) === String(barberId) && a.status === "processing",
    );
    if (activeJobs.length > 0) {
      return { label: "مشغول حالياً", color: "bg-rose-500", isBusy: true };
    }
    return { label: "متاح وجاهز", color: "bg-emerald-500", isBusy: false };
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(value);
  };

  // تقسيم المواعيد
  const waitingList = appointments.filter(
    (a) => a.status === "waiting" || a.status === "pending",
  );
  const processingList = appointments.filter((a) => a.status === "in_progress");
  const completedList = appointments.filter((a) => a.status === "completed");

  // حساب نسبة إشغال الصالون
  const totalCapacity = barbers.length || 1;
  const occupancyRate = Math.min(
    (processingList.length / totalCapacity) * 100,
    100,
  );

  return (
    <div
      className="p-4 md:p-8 space-y-8 max-w-[1800px] mx-auto text-slate-100 min-h-screen bg-[#020617]"
      dir="rtl"
    >
      {/* ── HEADER & LIVE METRICS ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-900/80 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Monitor className="text-indigo-400" size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              مركز الاستقبال
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              مزامنة حية (Live Sync) قيد العمل
            </p>
          </div>
        </div>

        {/* نسبة الإشغال (Occupancy Bar) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-400">
            <span>إشغال الكراسي</span>
            <span className="text-indigo-400">
              {Math.round(occupancyRate)}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${occupancyRate}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                occupancyRate >= 100
                  ? "bg-rose-500"
                  : occupancyRate >= 70
                    ? "bg-amber-500"
                    : "bg-indigo-500",
              )}
            />
          </div>
        </div>

        <Button
          onClick={() => setIsFastClientModalOpen(true)}
          className="w-full lg:w-auto rounded-[1.5rem] h-14 px-8 font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-3 text-base"
        >
          <UserPlus size={20} /> تسجيل دخول سريع
        </Button>
      </div>

      {/* ── BARBER LIVE STATUS ── */}
      <div className="flex flex-wrap gap-3">
        {barbers.map((b) => {
          const isBusy = processingList.some(
            (a) => String(a.employee_id) === String(b.id),
          );
          return (
            <div
              key={b.id}
              className={cn(
                "pl-4 pr-2 py-1.5 rounded-2xl border flex items-center gap-3 transition-all",
                isBusy
                  ? "bg-rose-500/5 border-rose-500/20 text-rose-400"
                  : "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
              )}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden border border-white/5 font-black text-xs">
                  {getBarberAvatarUrl(b) ? (
                    <img src={getBarberAvatarUrl(b)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    b.display_name?.charAt(0) || b.full_name?.charAt(0)
                  )}
                </div>
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950",
                    isBusy ? "bg-rose-500 animate-pulse" : "bg-emerald-500",
                  )}
                />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider ml-1">
                {b.display_name || b.full_name}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── KANBAN BOARD ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
        {/* صالة الانتظار */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-lg text-amber-400 flex items-center gap-2 tracking-tight">
              <Clock size={20} /> صالة الانتظار
            </h3>
            <Badge className="bg-amber-500 text-white font-bold rounded-lg px-3 py-1 shadow-lg shadow-amber-500/20 border-none">
              {waitingList.length}
            </Badge>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar pr-2 pb-4">
            <AnimatePresence>
              {waitingList.length === 0 ? (
                <EmptyState
                  icon={Coffee}
                  title="الصالة فارغة"
                  desc="لا يوجد عملاء في الانتظار حالياً."
                />
              ) : (
                waitingList.map((appt, idx) => (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 bg-slate-900 border border-white/5 rounded-[2rem] flex flex-col gap-4 group hover:border-amber-500/30 transition-all hover:shadow-2xl hover:shadow-amber-500/5 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-lg text-white mb-1">
                          {appt.customerName || appt.customer_name}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-slate-800 text-slate-300 hover:bg-slate-700 border-none text-[10px]">
                            {appt.serviceName}
                          </Badge>
                          <Badge
                            className={cn(
                              "border-none text-[10px]",
                              appt.employee_id
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-amber-500/20 text-amber-400",
                            )}
                          >
                            {appt.employee_id
                              ? appt.employeeName
                              : "انتظار عام"}
                          </Badge>
                        </div>
                      </div>
                      {/* Fake Timer Badge for UX */}
                      <div
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1",
                          getWaitTimeColor(Math.floor(Math.random() * 40)),
                        )}
                      >
                        <Clock size={12} /> {Math.floor(Math.random() * 20) + 5}{" "}
                        د
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <Button
                        className="flex-1 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all font-bold h-10"
                        onClick={() =>
                          handleUpdateStatus(appt.id, "in_progress")
                        }
                      >
                        <Play size={16} className="ml-2" /> إدخال للكرسي
                      </Button>
                      {!appt.employee_id && (
                        <Button
                          variant="outline"
                          className="flex-none rounded-xl border-white/10 text-slate-400 hover:text-white h-10 px-3"
                          onClick={() => setAssigningAppt(appt)}
                        >
                          <Scissors size={18} />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* جاري العمل */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-lg text-indigo-400 flex items-center gap-2 tracking-tight">
              <Activity size={20} className="animate-pulse" /> جاري الخدمة الآن
            </h3>
            <Badge className="bg-indigo-600 text-white font-bold rounded-lg px-3 py-1 shadow-lg shadow-indigo-600/20 border-none">
              {processingList.length}
            </Badge>
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar pr-2 pb-4">
            <AnimatePresence>
              {processingList.length === 0 ? (
                <EmptyState
                  icon={Scissors}
                  title="الكراسي فارغة"
                  desc="لا توجد عمليات نشطة في هذه اللحظة."
                />
              ) : (
                processingList.map((appt, idx) => (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-1 rounded-[2rem] bg-gradient-to-b from-indigo-500/20 to-transparent relative overflow-hidden"
                  >
                    <div className="p-4 bg-slate-900 rounded-[1.8rem] border border-white/5 flex justify-between items-center h-full">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xl border border-indigo-500/20 overflow-hidden">
                          {getBarberAvatarUrl(barbers.find(b => String(b.id) === String(appt.employee_id))) ? (
                            <img 
                                src={getBarberAvatarUrl(barbers.find(b => String(b.id) === String(appt.employee_id)))} 
                                alt="" 
                                className="w-full h-full object-cover"
                            />
                          ) : (
                            appt.employeeName?.charAt(0) || <User size={20} />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-white">
                            {appt.customerName || appt.customer_name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {appt.serviceName} • {appt.employeeName}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        className="bg-emerald-500 hover:bg-emerald-400 rounded-xl h-12 w-12 shadow-lg shadow-emerald-500/20 transition-all hover:scale-110"
                        onClick={() => handleUpdateStatus(appt.id, "completed")}
                      >
                        <Check
                          size={24}
                          strokeWidth={3}
                          className="text-white"
                        />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* المكتمل */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-lg text-emerald-400 flex items-center gap-2 tracking-tight">
              <CheckCircle2 size={20} /> مكتمل ومغلق اليوم
            </h3>
            <Badge className="bg-emerald-500 text-white font-bold rounded-lg px-3 py-1 shadow-lg shadow-emerald-500/20 border-none">
              {completedList.length}
            </Badge>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[70vh] custom-scrollbar pr-2 pb-4">
            <AnimatePresence>
              {completedList.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="لا يوجد عمليات"
                  desc="لم تكتمل أي حجوزات لهذا اليوم حتى الآن."
                />
              ) : (
                completedList.map((appt) => (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-white/5 rounded-2xl border border-white/5 opacity-60 hover:opacity-100 transition-opacity flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-300 line-through decoration-slate-500">
                        {appt.customerName || appt.customer_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {appt.serviceName}
                      </p>
                    </div>
                    <CheckCircle2 size={20} className="text-emerald-500/50" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      {/* ── 1. FAST CLIENT WALK-IN MODAL (PREMIUM & RESPONSIVE) ── */}
      <Dialog
        open={isFastClientModalOpen}
        onOpenChange={setIsFastClientModalOpen}
      >
        <DialogContent
          className="max-w-7xl w-[95%] md:w-[90%] rounded-[2rem] md:rounded-[3rem] p-0 overflow-hidden border-none shadow-3xl bg-slate-900 text-right"
          dir="rtl"
        >
          <DialogTitle className="sr-only">تسجيل دخول سريع</DialogTitle>
          <DialogDescription className="sr-only">
            تسجيل عميل سريع واختيار الخدمة والخبير المسؤول.
          </DialogDescription>
          <div className="flex flex-col lg:flex-row min-h-[85vh] lg:h-[80vh] w-full overflow-y-auto lg:overflow-hidden">
            {/* COLUMN 1: CONCIERGE / SMART RECOGNITION */}
            <div className="w-full lg:w-[28%] p-6 md:p-8 flex flex-col justify-between bg-slate-950/60 shrink-0 border-b lg:border-b-0 lg:border-l border-white/5">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                    التعرف الذكي
                  </h2>
                  <p className="text-slate-400 text-xs md:text-sm font-medium leading-relaxed opacity-80">
                    نظام concierge لتحليل بيانات العميل وتوقعات الخدمة.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {existingCustomer ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 md:space-y-6"
                    >
                      <div className="h-px w-full bg-white/10" />
                      <div className="space-y-3 md:space-y-4">
                        <div className="flex items-center gap-4 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/5">
                          <div className="p-2 md:p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shadow-inner">
                            <History size={16} />
                          </div>
                          <div>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                              آخر زيارة
                            </p>
                            <p className="text-sm md:text-base font-bold text-white tabular-nums">
                              منذ 12 يوم
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/5">
                          <div className="p-2 md:p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shadow-inner">
                            <Star size={16} />
                          </div>
                          <div>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                              الخبير المفضل
                            </p>
                            <p className="text-sm md:text-base font-bold text-white truncate max-w-[140px]">
                              {existingCustomer.last_employee_name ||
                                "غير محدد"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/5">
                          <div className="p-2 md:p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shadow-inner">
                            <TrendingUp size={16} />
                          </div>
                          <div>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                              إجمالي الزيارات
                            </p>
                            <p className="text-sm md:text-base font-bold text-white tabular-nums">
                              24 زيارة
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 md:p-4 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-xs font-bold text-indigo-200">
                            عميل ذهبي VIP
                          </p>
                        </div>
                        <ShieldCheck size={18} className="text-emerald-400" />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-12 lg:pt-20 text-center space-y-4 opacity-40"
                    >
                      <UserPlus size={40} className="text-slate-500 mx-auto" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider leading-relaxed">
                        أدخل رقم الجوال لفتح ملف العمليات
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="hidden lg:block pt-6 border-t border-white/5 text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em]">
                PRO ERP v4.2
              </div>
            </div>

            {/* COLUMN 2: INPUTS & SERVICE SELECTION */}
            <div className="flex-1 p-5 md:p-8 lg:p-10 space-y-8 bg-slate-50 dark:bg-slate-900/40 border-y lg:border-y-0 lg:border-x border-slate-100 dark:border-white/5 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pr-1">
                    <Phone size={14} className="text-indigo-600" /> التعرف
                    بالهاتف
                  </label>
                  <div className="relative group">
                    <Input
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                      className="h-14 md:h-16 rounded-2xl md:rounded-[1.5rem] bg-white dark:bg-slate-950 border-2 border-transparent focus:border-indigo-600/30 font-black text-xl md:text-2xl transition-all pl-14 shadow-sm text-white"
                      value={fastClientData.phone}
                      onChange={(e) =>
                        setFastClientData((p) => ({
                          ...p,
                          phone: e.target.value,
                        }))
                      }
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      {isSearchingCustomer ? (
                        <RefreshCw
                          className="animate-spin text-indigo-600"
                          size={20}
                        />
                      ) : existingCustomer ? (
                        <div className="bg-emerald-500 rounded-full p-1 shadow-lg">
                          <Check className="text-white" size={14} />
                        </div>
                      ) : (
                        <Search className="text-slate-500" size={20} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pr-1">
                    <User size={14} className="text-indigo-600" /> الاسم الكامل
                  </label>
                  <Input
                    placeholder="أدخل اسم العميل..."
                    className="h-14 md:h-16 rounded-2xl md:rounded-[1.5rem] bg-white dark:bg-slate-950 border-2 border-transparent focus:border-indigo-600/30 font-black text-base md:text-lg transition-all shadow-sm text-white"
                    value={fastClientData.firstName}
                    disabled={!!existingCustomer}
                    onChange={(e) =>
                      setFastClientData((p) => ({
                        ...p,
                        firstName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-600" /> قائمة
                    الخدمات الذكية
                  </label>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-black border-none bg-indigo-500/10 text-indigo-400 px-2.5 py-1"
                  >
                    {filteredServices.length} خدمة
                  </Badge>
                </div>

                <Tabs
                  value={activeCategoryTab}
                  onValueChange={setActiveCategoryTab}
                  className="w-full"
                >
                  <TabsList className="bg-transparent h-auto p-0 gap-2 overflow-x-auto no-scrollbar justify-start mb-4 pb-2 flex flex-nowrap w-full">
                    <TabsTrigger
                      value="all"
                      className="rounded-xl px-5 py-2.5 text-xs font-black data-[state=active]:bg-indigo-600 data-[state=active]:text-white shadow-sm transition-all shrink-0"
                    >
                      الكل
                    </TabsTrigger>
                    {categories.map((cat) => (
                      <TabsTrigger
                        key={cat.id}
                        value={String(cat.id)}
                        className="rounded-xl px-5 py-2.5 text-xs font-black data-[state=active]:bg-indigo-600 data-[state=active]:text-white whitespace-nowrap shadow-sm transition-all shrink-0"
                      >
                        {cat.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[320px] lg:max-h-[380px] overflow-y-auto pr-1 custom-scrollbar p-0.5">
                    {filteredServices.map((s) => {
                      const active =
                        String(fastClientData.serviceId) === String(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() =>
                            setFastClientData((p) => ({
                              ...p,
                              serviceId: String(s.id),
                            }))
                          }
                          className={cn(
                            "flex flex-col items-start p-4 md:p-5 rounded-2xl md:rounded-[1.75rem] border-2 transition-all text-right relative group w-full",
                            active
                              ? "border-indigo-600 bg-slate-950 dark:bg-indigo-600/10 shadow-xl shadow-indigo-600/5 scale-[1.01]"
                              : "bg-white dark:bg-slate-950 border-transparent hover:border-slate-800 shadow-sm",
                          )}
                        >
                          <div className="w-full flex justify-between items-center mb-3">
                            <div
                              className={cn(
                                "h-9 w-9 rounded-xl flex items-center justify-center transition-all",
                                active
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-900 text-slate-500",
                              )}
                            >
                              <Ticket size={16} />
                            </div>
                            {active && (
                              <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg animate-in zoom-in">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </div>

                          <div className="min-h-[2.5rem] mb-2 w-full">
                            <h4 className="text-xs md:text-sm font-black text-white leading-snug line-clamp-2">
                              {s.name_ar || s.name}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                              {s.duration || 30} دقيقة تقريباً
                            </p>
                          </div>

                          <div className="w-full pt-3 border-t border-slate-900 flex justify-between items-center">
                            <span className="text-sm md:text-base font-black text-indigo-400 tabular-nums">
                              {formatCurrency(s.sell_price || s.price)}
                            </span>
                            <Zap
                              size={12}
                              className={cn(
                                "transition-opacity",
                                active
                                  ? "text-indigo-400 opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Tabs>
              </div>
            </div>

            {/* COLUMN 3: EXPERT ASSIGNMENT & ACTION */}
            <div className="w-full lg:w-[32%] p-6 md:p-8 lg:p-10 space-y-6 bg-slate-950 flex flex-col justify-between shrink-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Scissors size={16} className="text-indigo-600" /> تعيين
                    الخبير المسؤول
                  </label>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-black opacity-70 border-none bg-slate-900 text-slate-400"
                  >
                    {barbers.length} متاح
                  </Badge>
                </div>

                <div className="space-y-3 max-h-[220px] lg:max-h-[340px] overflow-y-auto pr-1 custom-scrollbar p-0.5">
                  <button
                    onClick={() =>
                      setFastClientData((p) => ({ ...p, employeeId: "none" }))
                    }
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all relative group",
                      fastClientData.employeeId === "none"
                        ? "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5 scale-[1.01]"
                        : "border-transparent bg-slate-900 hover:border-slate-800",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-md",
                          fastClientData.employeeId === "none"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-950 text-slate-500",
                        )}
                      >
                        <Zap
                          size={20}
                          fill={
                            fastClientData.employeeId === "none"
                              ? "white"
                              : "none"
                          }
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-white block leading-tight mb-0.5">
                          انتظار عام
                        </span>
                        <p className="text-[9px] font-bold text-slate-500 tracking-tighter">
                          توجيه ذكي حسب الأولوية
                        </p>
                      </div>
                    </div>
                    {fastClientData.employeeId === "none" && (
                      <div className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>

                  <div className="h-px w-full bg-slate-900 my-2" />

                  {barbers.map((b) => {
                    const selected =
                      String(fastClientData.employeeId) === String(b.id);
                    const status = getBarberStatusInModal(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() =>
                          setFastClientData((p) => ({
                            ...p,
                            employeeId: String(b.id),
                          }))
                        }
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all relative group",
                          selected
                            ? "border-indigo-600 bg-indigo-600/10 shadow-lg shadow-indigo-600/5 scale-[1.01]"
                            : "border-transparent bg-slate-900 hover:border-slate-800",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div
                              className={cn(
                                "w-11 h-11 rounded-xl flex items-center justify-center font-black text-base transition-all overflow-hidden border border-white/5",
                                selected
                                  ? "bg-indigo-600 text-white"
                                  : "bg-slate-950 text-slate-400",
                              )}
                            >
                              {getBarberAvatarUrl(b) ? (
                                <img src={getBarberAvatarUrl(b)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                b.display_name?.charAt(0) || b.full_name?.charAt(0)
                              )}
                            </div>
                            <div
                              className={cn(
                                "absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 shadow-sm",
                                status.color,
                                status.isBusy && "animate-pulse",
                              )}
                            />
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-white block leading-tight mb-1">
                              {b.display_name || b.full_name}
                            </span>
                            <Badge
                              className={cn(
                                "text-[8px] font-black border-none px-1.5 py-0.5 rounded",
                                selected
                                  ? "bg-indigo-600/20 text-indigo-400"
                                  : "bg-slate-950 text-slate-500",
                              )}
                            >
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                        {selected && (
                          <div className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 pt-4 lg:pt-0">
                <div className="p-5 md:p-6 rounded-[1.75rem] bg-indigo-600 text-white relative overflow-hidden shadow-xl transition-all group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:scale-120 transition-transform duration-500" />
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.1em] mb-1 opacity-90">
                        إجمالي تكلفة الخدمة
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl md:text-4xl font-black tabular-nums tracking-tighter">
                          {selectedServicePrice}
                        </span>
                        <span className="text-xs font-black opacity-80 uppercase">
                          ج.م
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                      <Wallet size={24} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsFastClientModalOpen(false)}
                    className="rounded-xl h-14 px-4 font-black text-slate-500 hover:text-slate-300 text-sm tracking-wider flex-1"
                  >
                    إغلاق
                  </Button>
                  <Button
                    className="flex-[2] rounded-xl h-14 font-black shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white text-base transition-all active:scale-98 group"
                    onClick={handleAddFastClient}
                    disabled={actionLoading !== null}
                    loading={actionLoading === "adding-fast-client"}
                  >
                    <Zap
                      size={18}
                      fill="white"
                      className="ml-2 group-hover:animate-pulse"
                    />{" "}
                    تأكيد الدخول
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 2. ASSIGN BARBER MODAL ── */}
      <Dialog
        open={assigningAppt !== null}
        onOpenChange={() => setAssigningAppt(null)}
      >
        <DialogContent
          className="max-w-2xl rounded-[3rem] p-12 border-none shadow-3xl bg-slate-900 text-right"
          dir="rtl"
        >
          <DialogHeader className="mb-8 text-right">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-xl">
                <Scissors size={24} />
              </div>
              <DialogTitle className="text-3xl font-bold text-white tracking-tighter">
                توجيه المهمة
              </DialogTitle>
            </div>
            <p className="text-slate-400 font-medium text-base px-2">
              العميل:{" "}
              <span className="text-indigo-400 font-bold">
                {assigningAppt?.customerName || assigningAppt?.customer_name}
              </span>
            </p>
            <DialogDescription className="px-2 pt-2 text-slate-400">
              اختر الخبير الذي سيتولى هذه الخدمة الآن.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 py-4">
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => handleAssignBarber(assigningAppt.id, b.id)}
                className="flex flex-col items-center gap-5 p-6 rounded-[2.5rem] bg-white/5 border-2 border-transparent hover:border-indigo-600/30 hover:bg-indigo-600/10 transition-all group text-center"
              >
                <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-2xl group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm overflow-hidden">
                  {getBarberAvatarUrl(b) ? (
                    <img src={getBarberAvatarUrl(b)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    b.display_name?.charAt(0) || b.full_name?.charAt(0)
                  )}
                </div>
                <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 truncate w-full">
                  {b.display_name || b.full_name}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
