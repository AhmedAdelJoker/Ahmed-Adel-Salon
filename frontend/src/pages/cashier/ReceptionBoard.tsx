import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { useSocket } from "@/context/SocketContext";
import { PageShell } from "@/components/shared/PageShell";
import { useTranslation } from "react-i18next";
import {
  useAppointments,
  useEmployees,
  useServices,
  useServiceCategories,
  useUpdateAppointmentStatus,
  useAssignBarber,
  QUERY_KEYS,
} from "@/hooks/useAppointments";
import {
  COLUMNS,
  useReceptionBoard,
  ReceptionHeader,
  ReceptionKpis,
  ReceptionToolbar,
  DonePanel,
  ReceptionKanbanBoard,
  FastClientDialog,
  ReceptionActionDialogs,
} from "@/features/reception";

/**
 * normalizeArabic — يزيلiformات الهمزة ويوحد الألف للعثور على العملاء
 * بغض النظر عن كتابة الهمزة (أ، إ، آ، ا) في قاعدة البيانات أو البحث.
 */
function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .toLowerCase()
    .trim();
}

export default function ReceptionBoard() {
  const { t } = useTranslation("reception");
  const navigate = useNavigate();
  const socketCtx = useSocket();
  const socket = socketCtx?.socket ?? null;
  const connected = socketCtx?.connected ?? false;
  const queryClient = useQueryClient();
  const [isFastClientModalOpen, setIsFastClientModalOpen] = useState(false);
  const [fastClientSaving, setFastClientSaving] = useState(false);

  const [assigningAppt, setAssigningAppt] = useState<any>(null);
  const [cancelAppt, setCancelAppt] = useState<any>(null);

  const [fastClientData, setFastClientData] = useState<any>({
    phone: "",
    firstName: "",
    serviceIds: [],
    employeeId: "none",
    notes: "",
    appointmentTime: "", // اختيار الوقت يدوياً
  });

  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [activeCategory, setActiveCategory] = useState(t("fast_client.category_all"));

  // ---- Error state for API failures ----
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: appointments = [], isFetching: appointmentsFetching, error: appointmentsError } =
    useAppointments({ dateFilter: "today" });
  const { data: barbers = [] } = useEmployees();
  const { data: services = [] } = useServices();
  const { data: categories = [] } = useServiceCategories();

  const statusMutation = useUpdateAppointmentStatus();
  const assignMutation = useAssignBarber();

  useEffect(() => {
    if (appointmentsError) {
      setApiError(appointmentsError.message);
    } else {
      setApiError(null);
    }
  }, [appointmentsError]);

  const loading = appointmentsFetching && appointments.length === 0 && !apiError;
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
    setApiError(null);
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
            toast.success(t("fast_client.customer_found", { name: customerData.first_name }), {
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
  }, [fastClientData.phone, t]);

  const filteredServices = useMemo(() => {
    if (activeCategory === t("fast_client.category_all")) return services;
    return services.filter(
      (s) =>
        s.category_name === activeCategory ||
        String(s.category_id) === String(activeCategory),
    );
  }, [services, activeCategory, t]);

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
      toast.success(t("board.refresh"));
    } catch (error) {
      const apiErr = error as { response?: { data?: { detail?: unknown } } };
      toast.error(
        (apiErr?.response?.data?.detail as string) || t("board.error_message"),
      );
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

  const handleTimeChange = (time: string) => {
    setFastClientData((prev) => ({ ...prev, appointmentTime: time }));
  };

  const handleFastClientSubmit = async (e) => {
    e.preventDefault();
    if (!fastClientData.serviceIds.length) {
      toast.error(t("fast_client.validation_service"));
      return;
    }
    if (!fastClientData.phone?.trim() || !fastClientData.firstName?.trim()) {
      toast.error(t("fast_client.validation_phone_name"));
      return;
    }
    // التحقق من صحة رقم الموبايل (مصري: يبدأ بـ 01 ומكون من 11 رقم)
    const phoneRegex = /^01[0-2,5]\d{8}$/;
    if (!phoneRegex.test(fastClientData.phone.trim())) {
      toast.error(t("fast_client.validation_phone_invalid"));
      return;
    }
    if (fastClientSaving) return;
    setFastClientSaving(true);
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
        appointment_time: fastClientData.appointmentTime || undefined,
      };
      await api.post("/appointments/fast-walkin", payload);
      toast.success(t("fast_client.success"));
      setIsFastClientModalOpen(false);
      setFastClientData({
        phone: "",
        firstName: "",
        serviceIds: [],
        employeeId: "none",
        notes: "",
        appointmentTime: "",
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments });
    } catch (error) {
      const apiErr = error as { response?: { status?: number; data?: { detail?: unknown } } };
      // خطأ 409 يعني أن الخبير محجوز في هذا التوقيت
      if (apiErr?.response?.status === 409) {
        toast.error(t("fast_client.error_barber_busy"));
      } else {
        toast.error(
          (apiErr?.response?.data?.detail as string) || t("fast_client.error"),
        );
      }
    } finally {
      setFastClientSaving(false);
    }
  };

  const columnLists = {
    waiting: waitingList,
    in_service: inServiceList,
    review: reviewList,
    cashier: atCashierList,
  };

  // ---- Error UI ----
  if (apiError) {
    return (
      <PageShell className="relative">
        <ReceptionHeader
          connected={connected}
          appointmentsFetching={false}
          onRefresh={refresh}
          onNewClient={() => setIsFastClientModalOpen(true)}
        />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 sm:p-12">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-black text-main mb-2">{t("board.error_title")}</h2>
          <p className="text-muted mb-6 max-w-sm">{t("board.error_message")}</p>
          <button
            onClick={refresh}
            className="px-6 py-3 rounded-xl font-black bg-primary text-white hover:bg-accent-strong transition-all shadow-lg shadow-primary/20"
          >
            {t("board.error_retry")}
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="relative">
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
      <ReceptionKanbanBoard
        columnLists={columnLists}
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

      <DonePanel show={showDone} list={doneList} revenue={kpis.revenue} />

      {/* ── MODALS ── */}
      <FastClientDialog
        open={isFastClientModalOpen}
        onOpenChange={setIsFastClientModalOpen}
        fastClientData={fastClientData}
        setFastClientData={setFastClientData}
        foundCustomer={foundCustomer}
        isSearchingCustomer={isSearchingCustomer}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        categories={categories}
        filteredServices={filteredServices}
        toggleService={toggleService}
        totalPrice={totalPrice}
        totalDuration={totalDuration}
        barbers={barbers}
        appointmentTime={fastClientData.appointmentTime}
        onTimeChange={handleTimeChange}
        onSubmit={handleFastClientSubmit}
        saving={fastClientSaving}
        t={t}
      />

      <ReceptionActionDialogs
        assigningAppt={assigningAppt}
        setAssigningAppt={setAssigningAppt}
        barbers={barbers}
        onReassignBarber={handleReassignBarber}
        cancelAppt={cancelAppt}
        setCancelAppt={setCancelAppt}
        onConfirmCancel={confirmCancel}
        t={t}
      />
    </PageShell>
  );
}
