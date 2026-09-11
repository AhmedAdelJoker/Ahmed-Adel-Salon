import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  RefreshCw,
  Phone,
  User,
  UserPlus,
  Search,
  Check,
  Scissors,
  Star,
  AlertCircle,
  Trash2,
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
import { formatCurrency, cn } from "@/lib/core/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  COLUMNS,
  useReceptionBoard,
  BoardColumn,
  ReceptionHeader,
  ReceptionKpis,
  ReceptionToolbar,
  DonePanel,
} from "@/features/reception";




export default function ReceptionBoard() {
  const navigate = useNavigate();
  const socketCtx = useSocket();
  const socket = socketCtx?.socket ?? null;
  const connected = socketCtx?.connected ?? false;
  const queryClient = useQueryClient();
  const [isFastClientModalOpen, setIsFastClientModalOpen] = useState(false);
   
  const [assigningAppt, setAssigningAppt] = useState<any>(null);
   
  const [cancelAppt, setCancelAppt] = useState<any>(null);
   
   

   
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
  const {
    searchTerm,
    setSearchTerm,
    barberFilter,
    setBarberFilter,
    showDone,
    setShowDone,
    draggingId,
    setDraggingId,
    dropCol,
    setDropCol,
    now,
    waitingList,
    inServiceList,
    reviewList,
    atCashierList,
    doneList,
    kpis,
  } = useReceptionBoard(appointments);

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
      <ReceptionHeader
        connected={connected}
        appointmentsFetching={appointmentsFetching}
        onRefresh={refresh}
        onNewClient={() => setIsFastClientModalOpen(true)}
      />

      <ReceptionKpis kpis={kpis} />

      <ReceptionToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        barberFilter={barberFilter}
        onBarberFilter={setBarberFilter}
        barbers={barbers}
        showDone={showDone}
        onToggleDone={() => setShowDone((v) => !v)}
        doneCount={doneList.length}
      />

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

      <DonePanel show={showDone} list={doneList} revenue={kpis.revenue} />

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




