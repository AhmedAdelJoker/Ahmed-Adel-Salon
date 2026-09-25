import { useEffect, useState, useCallback, useMemo } from "react";
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
      toast.error(
        (apiErr?.response?.data?.detail as string) || "فشل تحديث الحالة",
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
      toast.error(
        (apiErr?.response?.data?.detail as string) || "فشل تسجيل العميل",
      );
    }
  };

  const columnLists = {
    waiting: waitingList,
    in_service: inServiceList,
    review: reviewList,
    cashier: atCashierList,
  };

  return (
    <div className="erp-page-container space-y-6 pb-16 relative">
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
        onSubmit={handleFastClientSubmit}
      />

      <ReceptionActionDialogs
        assigningAppt={assigningAppt}
        setAssigningAppt={setAssigningAppt}
        barbers={barbers}
        onReassignBarber={handleReassignBarber}
        cancelAppt={cancelAppt}
        setCancelAppt={setCancelAppt}
        onConfirmCancel={confirmCancel}
      />
    </div>
  );
}
