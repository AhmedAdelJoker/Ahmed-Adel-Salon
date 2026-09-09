import { useEffect, useMemo, useState, useRef } from "react";
import { Calendar } from "lucide-react";
import { toast } from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "@/context/SocketContext";

import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { getApiErrorMessage } from "@/lib/core/utils";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";

import {
  TODAY,
  timeOnly,
  emptyForm,
  useBookingsBoard,
} from "@/features/bookings";
import {
  SalonCapacityBanner,
  BookingsStatsGrid,
  BookingsHeaderActions,
  BookingsToolbar,
  BookingsBoardContent,
  BookingFormDialog,
  WalkInDialog,
  CancelBookingDialog,
} from "@/features/bookings/components";

export default function Bookings() {
  const navigate = useNavigate();
  const location = useLocation();
  const socketContext = useSocket?.();
  const socket = socketContext?.socket || null;
  const connected = socketContext?.connected || false;
  const {
    dateFilter,
    setDateFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activeTab,
    setActiveTab,
    quickFilter,
    setQuickFilter,
    searchTerm,
    setSearchTerm,
    selectedEmployeeId,
    setSelectedEmployeeId,
    refreshing,
    lastUpdated,
    setLastUpdated,
    bookings,
    employees,
    services,
    categories,
    appointmentsQuery,
    salonCapacity,
    stats,
    tabCounts,
    filteredBookings,
    invalidateAppointments,
    refreshBookings,
  } = useBookingsBoard();

  const phoneInputRef = useRef<any>(null);

  const searchInputRef = useRef<any>(null);

  const phoneTimerRef = useRef<any>(null);

  // UI & Filter States (board filters live in useBookingsBoard)
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);

  const [walkInData, setWalkInData] = useState<any>({
    phone: "",
    firstName: "",
    lastName: "",
    employeeId: "",
    serviceIds: [],
    notes: "",
  });
  const [walkInSaving, setWalkInSaving] = useState(false);

  const [walkInCustomer, setWalkInCustomer] = useState<any>(null);

  const [walkInSuggestions, setWalkInSuggestions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [actionLoading, setActionLoading] = useState<any>(null);

  const [duplicateBooking, setDuplicateBooking] = useState<any>(null);
  const [viewMode, setViewMode] = useState("grid");

  // ── CRITICAL: Form & Modal State (was missing – caused crash) ──

  const [formData, setFormData] = useState<any>({ ...emptyForm });
  const [customerMode, setCustomerMode] = useState("search");

  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [conflictMsg, setConflictMsg] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("all");

  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);

  const [availableSlots, setAvailableSlots] = useState<any[]>([]);

  // Run auto-cancel once per "today" view load (keeps board consistent)
  useEffect(() => {
    if (dateFilter !== "today") return;
    api
      .post("/appointments/auto-cancel-expired")
      .catch(() => console.debug("auto-cancel-expired failed"));
  }, [dateFilter]);

  // Keep "last updated" fresh whenever React Query finishes a fetch
  useEffect(() => {
    if (!appointmentsQuery.isFetching) {
      setLastUpdated(new Date());
    }
  }, [appointmentsQuery.isFetching]);

  useEffect(() => {
    return () => clearTimeout(phoneTimerRef.current);
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(
        e.target.tagName,
      );

      if (e.key === "Escape") {
        setIsModalOpen(false);
        setIsCancelDialogOpen(false);
      }

      if (!isTyping) {
        if (
          e.key.toLowerCase() === "n" ||
          (e.altKey && e.key.toLowerCase() === "n")
        ) {
          e.preventDefault();
          openCreate();
        }
        if (e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live WebSocket updates → invalidate React Query cache
  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event?.startsWith("appointment_")) {
          invalidateAppointments();
        }
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };
    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, invalidateAppointments]);

  // Dynamic Cross-Page Navigators
  const handleTransferToPOS = (booking) => {
    toast.success("جاري الانتقال لنقطة البيع الكاشير...");
    navigate("/pos", {
      state: {
        bookingId: booking.id,
        customerId: booking.customer_id,
        barberId: booking.barber_id,
        services: booking.services,
      },
    });
  };

  const handleOpenCustomerProfile = (customerId) => {
    if (!customerId) return;
    navigate("/customers", { state: { customerId } });
  };

  const handleActivateBooking = async (booking) => {
    try {
      setActionLoading(`${booking.id}-activate`);
      await api.patch(`/appointments/${booking.id}/status`, {
        status: "waiting",
      });
      toast.success("تم تفعيل الحجز وإرساله للوحة الاستقبال");
      invalidateAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل تفعيل الحجز"));
    } finally {
      setActionLoading(null);
    }
  };

  // Reschedule booking to another day
  const handleRescheduleBooking = async (booking, newDate, newTime) => {
    try {
      setActionLoading(`${booking.id}-reschedule`);
      await api.patch(`/appointments/${booking.id}`, {
        appointment_date: newDate,
        appointment_time: newTime,
      });
      toast.success("تم إعادة جدولة الحجز بنجاح");
      invalidateAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل إعادة الجدولة"));
    } finally {
      setActionLoading(null);
    }
  };

  // Check if booking can be edited (same day only)
  const canEditBooking = (booking) => {
    const today = new Date().toISOString().slice(0, 10);
    const bookingDate = booking.appointment_date;
    // Can only edit if booking is today or in the future
    return bookingDate >= today;
  };

  // Check if booking is late (> 1 hour past scheduled time)
  const isBookingLate = (booking: any) => {
    const today = new Date().toISOString().slice(0, 10);
    if (booking.appointment_date !== today) return false;
    const now = new Date();
    const [h, m] = String(booking.appointment_time || "").split(":");
    const apptTime = new Date();
    apptTime.setHours(parseInt(h || "0"), parseInt(m || "0"), 0);
    const diffMinutes = Math.round((now.getTime() - apptTime.getTime()) / (1000 * 60));
    return diffMinutes > 60; // More than 1 hour late
  };

  const handleDragStart = (e, bookingId) => {
    e.dataTransfer.setData("text/plain", String(bookingId));
    e.dataTransfer.setData("bookingId", String(bookingId));
  };

  const handleDrop = async (e, targetBarberId) => {
    e.preventDefault();
    const bookingId =
      e.dataTransfer.getData("bookingId") ||
      e.dataTransfer.getData("text/plain");
    if (!bookingId || !targetBarberId) return;

    try {
      setActionLoading(`move-${bookingId}`);
      await api.patch(`/appointments/${bookingId}/assign-barber`, {
        employee_id: targetBarberId,
      });
      toast.success("تم تغيير الخبير بنجاح");
      invalidateAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل تغيير الخبير"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleChangeBookingStatus = async (booking, newStatus) => {
    if (newStatus === "CANCELLED") {
      setBookingToCancel(booking);
      setIsCancelDialogOpen(true);
      return;
    }

    try {
      setActionLoading(`${booking.id}-${newStatus}`);
      await api.patch(`/appointments/${booking.id}/status`, {
        status: newStatus.toLowerCase(),
      });
      toast.success("تم تحديث حالة الحجز");
      invalidateAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل تحديث الحالة"));
    } finally {
      setActionLoading(null);
    }
  };

  const confirmCancellation = async () => {
    if (!bookingToCancel) return;
    try {
      setSaving(true);
      await api.patch(`/appointments/${bookingToCancel.id}/status`, {
        status: "cancelled",
        cancellation_reason: cancellationReason || "بدون ذكر سبب",
      });
      toast.success("تم إلغاء الحجز بنجاح");
      setIsCancelDialogOpen(false);
      setCancellationReason("");
      invalidateAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل إلغاء الحجز"));
    } finally {
      setSaving(false);
      setBookingToCancel(null);
    }
  };

  const checkConflict = async (empId, date, time) => {
    if (!empId || !date || !time) return;

    let duration = 30;
    if (formData.services && formData.services.length > 0) {
      duration = formData.services.reduce((sum, item) => {
        const s = services.find((srv) => srv.id === item.serviceId);
        return sum + Number(s?.duration_minutes || 30) * item.quantity;
      }, 0);
    }

    try {
      const res = await api.get("/appointments/check-conflict", {
        params: {
          barber_id: empId,
          date,
          time,
          duration_minutes: duration,
          exclude_id: editingBooking?.id,
        },
      });
      if (res.data.has_conflict) setConflictMsg(res.data.message);
      else setConflictMsg("");
    } catch (e) {
      console.error(e);
    }
  };

  const checkCustomerDuplicate = async (customerId, date, excludeId = null) => {
    if (!customerId || !date) return;
    try {
      const res = await api.get("/appointments/check-customer-duplicate", {
        params: { customer_id: customerId, date, exclude_id: excludeId },
      });
      if (res.data.has_duplicate) {
        setDuplicateBooking(res.data);
      } else {
        setDuplicateBooking(null);
      }
    } catch (e) {
      console.error("Duplicate check error:", e);
    }
  };

  const fetchAvailableSlots = async (barberId, date) => {
    if (!barberId || !date) return;
    try {
      const res = await api.get("/appointments/available-slots", {
        params: { barber_id: barberId, date: date },
      });
      setAvailableSlots(res.data);
    } catch (e) {
      console.error("Error fetching slots:", e);
    }
  };

  const calculateEndTime = () => {
    if (!formData.appointmentTime || formData.services.length === 0)
      return null;

    const [h, m] = formData.appointmentTime.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0);

    const totalDuration = formData.services.reduce((sum, item) => {
      const s = services.find((srv) => srv.id === item.serviceId);
      return sum + Number(s?.duration_minutes || 30) * item.quantity;
    }, 0);

    const end = new Date(start.getTime() + totalDuration * 60000);
    return end.toTimeString().slice(0, 5);
  };

  const handlePhoneSearch = async (phone) => {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      setCustomerSuggestions([]);
      return;
    }

    try {
      const res = await api.get("/customers/search", {
        params: { phone: cleanPhone },
      });
      const results = adaptList(res);
      setCustomerSuggestions(results);
      if (results.length === 1) {
        const matched = results[0];
        selectSuggestedCustomer(matched);
      }
    } catch (err) {
      console.error("Search error:", err);
      setCustomerSuggestions([]);
    }
  };

  // Debounced phone search (fires 350ms after the user stops typing)
  const onPhoneChange = (value) => {
    const val = String(value || "").replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, customerPhone: val }));
    clearTimeout(phoneTimerRef.current);
    if (val.length < 8) {
      setCustomerSuggestions([]);
      return;
    }
    phoneTimerRef.current = setTimeout(() => {
      handlePhoneSearch(val);
    }, 350);
  };

  const selectSuggestedCustomer = (customer) => {
    setFoundCustomer(customer);
    const cId = customer.customer_id || customer.id || customer.customerId;
    setFormData((prev) => {
      const newState = {
        ...prev,
        customerId: String(cId),
        customerName: customer.first_name || customer.name,
        customerPhone: customer.phone,
      };
      checkCustomerDuplicate(cId, prev.appointmentDate, editingBooking?.id);
      return newState;
    });
    setCustomerMode("found");
    setCustomerSuggestions([]);
    toast.success(`تم اختيار: ${customer.first_name || customer.name}`);
  };

  const handleSaveBooking = async () => {
    if (customerMode === "search")
      return toast.error("يرجى إدخال رقم هاتف العميل للبحث");
    if (customerMode === "new" && !formData.customerName)
      return toast.error("يرجى إدخال اسم العميل الجديد");
    if (!formData.employeeId || formData.employeeId === "")
      return toast.error("يرجى اختيار الخبير المسؤول");
    if (!formData.appointmentTime) return toast.error("يرجى اختيار وقت الموعد");
    if (formData.services.length === 0)
      return toast.error("يرجى اختيار خدمة واحدة على الأقل");
    if (conflictMsg) return toast.error(conflictMsg);

    // Validate: no booking in the past
    const today = new Date().toISOString().slice(0, 10);
    if (formData.appointmentDate < today)
      return toast.error("لا يمكن الحجز في تاريخ سابق");
    if (formData.appointmentDate === today) {
      const now = new Date();
      const [h, m] = formData.appointmentTime.split(":").map(Number);
      const apptTime = new Date();
      apptTime.setHours(h, m, 0);
      if (apptTime <= now) return toast.error("لا يمكن الحجز في وقت مضى");
    }

    // Validate: no duplicate booking for same customer on same day
    if (duplicateBooking)
      return toast.error(
        duplicateBooking.message || "هذا العميل لديه حجز في هذا اليوم",
      );

    try {
      setSaving(true);
      let customerId = formData.customerId;

      if (customerMode === "new") {
        const res = await api.post("/customers", {
          first_name: formData.customerName,
          last_name: formData.customerLastName || "",
          phone: formData.customerPhone,
        });
        customerId = res.data.customer_id || res.data.id;
      }

      const payload = {
        customer_id: Number(customerId),
        barber_id: Number(formData.employeeId),
        appointment_date: formData.appointmentDate,
        appointment_time: formData.appointmentTime,
        notes: formData.notes,
        booking_source: formData.bookingSource || "shop",
        services: formData.services.map((s) => ({
          service_id: s.serviceId,
          quantity: s.quantity,
        })),
      };

      if (editingBooking) {
        await api.patch(`/appointments/${editingBooking.id}`, payload);
        toast.success("تم تحديث الحجز بنجاح");
      } else {
        await api.post("/appointments", payload);
        toast.success("تم تسجيل الحجز بنجاح");
      }
      setIsModalOpen(false);
      invalidateAppointments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "حدث خطأ أثناء الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  // Walk-in customer handler
  const handleWalkInPhoneSearch = async (phone) => {
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    setWalkInData((p) => ({ ...p, phone: cleanPhone }));
    if (cleanPhone.length < 8) {
      setWalkInSuggestions([]);
      setWalkInCustomer(null);
      return;
    }
    try {
      const res = await api.get("/customers/search", {
        params: { phone: cleanPhone },
      });
      const results = Array.isArray(res.data)
        ? res.data
        : [res.data].filter(Boolean);
      setWalkInSuggestions(results);
      if (results.length === 1) selectWalkInCustomer(results[0]);
    } catch (err) {
      setWalkInSuggestions([]);
    }
  };

  const selectWalkInCustomer = (customer) => {
    setWalkInCustomer(customer);
    setWalkInData((p) => ({
      ...p,
      phone: customer.phone || p.phone,
      firstName: customer.first_name || customer.name || "",
      lastName: customer.last_name || "",
    }));
    setWalkInSuggestions([]);
  };

  const handleWalkInSubmit = async () => {
    if (!walkInData.firstName.trim() || !walkInData.phone.trim()) {
      toast.error("يرجى إدخال اسم العميل ورقم الهاتف");
      return;
    }
    if (walkInData.serviceIds.length === 0)
      return toast.error("يرجى اختيار خدمة واحدة على الأقل");

    try {
      setWalkInSaving(true);
      let customerId = walkInCustomer?.customer_id || walkInCustomer?.id;

      if (!customerId) {
        const res = await api.post("/customers", {
          first_name: walkInData.firstName,
          last_name: walkInData.lastName || "",
          phone: walkInData.phone,
        });
        customerId = res.data.customer_id || res.data.id;
      }

      const res = await api.post("/appointments/fast-walkin", {
        customer_id: Number(customerId),
        service_ids: walkInData.serviceIds,
        employee_id:
          walkInData.employeeId === "auto"
            ? null
            : walkInData.employeeId || null,
        notes: walkInData.notes || "عميل مشاة (Walk-in)",
        booking_source: "walkin",
      });

      toast.success("تم تسجيل العميل وإضافته للاستقبال");
      setIsWalkInOpen(false);
      setWalkInData({
        phone: "",
        firstName: "",
        lastName: "",
        employeeId: "",
        serviceIds: [],
        notes: "",
      });
      setWalkInCustomer(null);
      setWalkInSuggestions([]);
      invalidateAppointments();
      navigate("/reception-board");
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      toast.error((apiErr?.response?.data?.detail as string) || "فشل تسجيل العميل");
    } finally {
      setWalkInSaving(false);
    }
  };

  const openCreate = () => {
    setEditingBooking(null);
    setFormData({ ...emptyForm, appointmentDate: TODAY });
    setCustomerMode("search");
    setFoundCustomer(null);
    setConflictMsg("");
    setDuplicateBooking(null);
    setAvailableSlots([]);
    setIsModalOpen(true);
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  };

  const openEdit = (b) => {
    // Prevent editing past bookings
    if (!canEditBooking(b)) {
      toast.error("لا يمكن تعديل حجز يوم سابق. يرجى إنشاء حجز جديد.");
      return;
    }
    setEditingBooking(b);
    setFormData({
      customerId: String(b.customer_id),
      customerName: b.customer_name || b.customerName,
      customerPhone: b.customer_phone || b.customerPhone,
      employeeId: String(b.barber_id),
      appointmentDate: b.appointment_date,
      appointmentTime: timeOnly(b.appointment_time),
      notes: b.notes || "",
      services: (b.services || []).map((s) => ({
        serviceId: s.service_id,
        quantity: s.quantity,
      })),
      bookingSource: b.booking_source || "shop",
    });
    setFoundCustomer({
      customer_id: b.customer_id,
      first_name: b.customer_name,
      phone: b.customer_phone,
      visit_count: b.visit_count,
    });
    setCustomerMode("found");
    setConflictMsg("");
    setDuplicateBooking(null);
    fetchAvailableSlots(b.barber_id, b.appointment_date);
    setIsModalOpen(true);
  };

  // Auto-open edit dialog when navigated from the reception board
  useEffect(() => {
    const target = location.state?.editAppointment;
    if (!target) return;
    const booking =
      bookings.find((b) => String(b.id) === String(target.id)) || target;
    openEdit(booking);
    window.history.replaceState({}, document.title);
  }, [location.state, bookings]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, any[]> = { all: [] };
    categories.forEach((cat) => {
      groups[cat.id] = [];
    });
    services.forEach((s) => {
      groups.all.push(s);
      const catId = s.category_id || s.categoryId;
      if (catId && groups[catId]) {
        groups[catId].push(s);
      }
    });
    return groups;
  }, [services, categories]);

  // Keep late-check helper available for future board badges (currently
  // rendered inside BookingCardFull to avoid duplicated logic).
  void isBookingLate;

  return (
    <div
      className="erp-page space-y-6 sm:space-y-8 pb-12 overflow-x-hidden"
      dir="rtl"
    >
      {/* ── HEADER WITH ALL ACTION TEXTS ALWAYS VISIBLE ── */}
      <PageHeader
        className={undefined}
        title="إدارة الحجوزات"
        subtitle="منظومة الحجوزات الشاملة المربوطة بنقطة البيع، لوحة الاستقبال، وسجل العملاء."
        badge={connected ? "متصل مباشر" : "غير متصل"}
        icon={Calendar}
        actions={
          <BookingsHeaderActions
            viewMode={viewMode}
            setViewMode={setViewMode}
            onNavigate={navigate}
            onWalkIn={() => setIsWalkInOpen(true)}
            onCreate={openCreate}
          />
        }
      />

      {/* ── SALON CAPACITY GAUGE ── */}
      <SalonCapacityBanner salonCapacity={salonCapacity} />

      {/* ── STATS OVERVIEW (CLICKABLE INTERACTIVE CARDS) ── */}
      <BookingsStatsGrid
        stats={stats}
        setActiveTab={setActiveTab}
        setQuickFilter={setQuickFilter}
      />

      {/* ── MAIN CONTENT CARD & TOOLBAR ── */}
      <PremiumCard noPadding className={undefined}>
        {/* Responsive Toolbar with Horizontal Scroll Support */}
        <BookingsToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          employees={employees}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          quickFilter={quickFilter}
          setQuickFilter={setQuickFilter}
          tabCounts={tabCounts}
          connected={connected}
          lastUpdated={lastUpdated}
          refreshing={refreshing}
          refreshBookings={refreshBookings}
          searchInputRef={searchInputRef}
        />

        {/* View Grid / Board Content */}
        <BookingsBoardContent
          isLoading={appointmentsQuery.isLoading}
          viewMode={viewMode}
          filteredBookings={filteredBookings}
          employees={employees}
          openEdit={openEdit}
          handleChangeBookingStatus={handleChangeBookingStatus}
          handleActivateBooking={handleActivateBooking}
          handleTransferToPOS={handleTransferToPOS}
          handleOpenCustomerProfile={handleOpenCustomerProfile}
          handleRescheduleBooking={handleRescheduleBooking}
          canEditBooking={canEditBooking}
          actionLoading={actionLoading}
          handleDragStart={handleDragStart}
          handleDrop={handleDrop}
          handleDragOver={handleDragOver}
        />
      </PremiumCard>

      {/* ── ADVANCED BOOKING MODAL (RESPONSIVE DIALOG) ── */}
      <BookingFormDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingBooking={editingBooking}
        formData={formData}
        setFormData={setFormData}
        customerMode={customerMode}
        foundCustomer={foundCustomer}
        customerSuggestions={customerSuggestions}
        duplicateBooking={duplicateBooking}
        conflictMsg={conflictMsg}
        availableSlots={availableSlots}
        employees={employees}
        services={services}
        categories={categories}
        groupedServices={groupedServices}
        selectedServiceCategory={selectedServiceCategory}
        setSelectedServiceCategory={setSelectedServiceCategory}
        onPhoneChange={onPhoneChange}
        selectSuggestedCustomer={selectSuggestedCustomer}
        checkConflict={checkConflict}
        checkCustomerDuplicate={checkCustomerDuplicate}
        fetchAvailableSlots={fetchAvailableSlots}
        calculateEndTime={calculateEndTime}
        onSave={handleSaveBooking}
        saving={saving}
        phoneInputRef={phoneInputRef}
      />

      {/* ── WALK-IN CUSTOMER MODAL ── */}
      <WalkInDialog
        open={isWalkInOpen}
        onOpenChange={setIsWalkInOpen}
        walkInData={walkInData}
        setWalkInData={setWalkInData}
        walkInCustomer={walkInCustomer}
        setWalkInCustomer={setWalkInCustomer}
        walkInSuggestions={walkInSuggestions}
        setWalkInSuggestions={setWalkInSuggestions}
        employees={employees}
        services={services}
        onPhoneSearch={handleWalkInPhoneSearch}
        onSelectCustomer={selectWalkInCustomer}
        onSubmit={handleWalkInSubmit}
        saving={walkInSaving}
      />
      <CancelBookingDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        bookingToCancel={bookingToCancel}
        cancellationReason={cancellationReason}
        setCancellationReason={setCancellationReason}
        onConfirm={confirmCancellation}
        saving={saving}
      />
    </div>
  );
}
