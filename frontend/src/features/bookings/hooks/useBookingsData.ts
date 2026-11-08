import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSocket } from "@/context/SocketContext";
import { toast } from "react-hot-toast";

import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import {
  TODAY,
  timeOnly,
  emptyForm,
  bookingApiErrorMessage,
  readBookingDraft,
  writeBookingDraft,
} from "@/features/bookings";
import type { BookingRecord } from "@/features/bookings/types";

import { useBookingsBoard } from "@/features/bookings/hooks/useBookingsBoard";

export function useBookingsData() {
  const { t } = useTranslation("bookings");
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<any>(null);
  const [duplicateBooking, setDuplicateBooking] = useState<any>(null);
  const [viewMode, setViewMode] = useState("grid");

  const [formData, setFormData] = useState<any>({ ...emptyForm });
  const [customerMode, setCustomerMode] = useState("search");
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [conflictMsg, setConflictMsg] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("all");
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  useEffect(() => {
    if (dateFilter !== "today") return;
    api
      .post("/appointments/auto-cancel-expired")
      .catch(() => console.debug("auto-cancel-expired failed"));
  }, [dateFilter]);

  useEffect(() => {
    if (!appointmentsQuery.isFetching) {
      setLastUpdated(new Date());
    }
  }, [appointmentsQuery.isFetching, setLastUpdated]);

  useEffect(() => {
    return () => clearTimeout(phoneTimerRef.current);
  }, []);

  // Persist the create-form draft while the dialog is open (create mode
  // only — edit mode already has a booking to edit).
  useEffect(() => {
    if (!isModalOpen || editingBooking) return;
    writeBookingDraft({
      customerMode,
      foundCustomer,
      customerId: formData.customerId,
      customerName: formData.customerName,
      customerLastName: formData.customerLastName,
      customerPhone: formData.customerPhone,
      employeeId: formData.employeeId,
      appointmentTime: formData.appointmentTime,
      notes: formData.notes,
      services: formData.services,
      bookingSource: formData.bookingSource,
    });
  }, [
    isModalOpen,
    editingBooking,
    formData,
    customerMode,
    foundCustomer,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (e.target as HTMLElement).tagName,
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

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event: MessageEvent) => {
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

  const handleTransferToPOS = useCallback(
    (booking: BookingRecord) => {
      toast.success(t("toasts.goingToPos"));
      navigate("/pos", {
        state: {
          bookingId: booking.id,
          customerId: booking.customer_id,
          barberId: booking.barber_id,
          services: booking.services,
        },
      });
    },
    [navigate, t],
  );

  const handleOpenCustomerProfile = useCallback(
    (customerId: string | number) => {
      if (!customerId) return;
      navigate("/customers", { state: { customerId } });
    },
    [navigate],
  );

  const handleActivateBooking = useCallback(
    async (booking: BookingRecord) => {
      try {
        setActionLoading(`${booking.id}-activate`);
        await api.patch(`/appointments/${booking.id}/status`, {
          status: "waiting",
        });
        toast.success(t("toasts.activated"));
        invalidateAppointments();
      } catch (err) {
        toast.error(
          bookingApiErrorMessage(err, t("toasts.activateFailed"), t("conflict.generic")),
        );
      } finally {
        setActionLoading(null);
      }
    },
    [invalidateAppointments, t],
  );

  const handleRescheduleBooking = useCallback(
    async (booking: BookingRecord, newDate: string, newTime: string) => {
      try {
        setActionLoading(`${booking.id}-reschedule`);
        await api.patch(`/appointments/${booking.id}`, {
          appointment_date: newDate,
          appointment_time: newTime,
        });
        toast.success(t("toasts.rescheduled"));
        invalidateAppointments();
      } catch (err) {
        toast.error(
          bookingApiErrorMessage(err, t("toasts.rescheduleFailed"), t("conflict.generic")),
        );
      } finally {
        setActionLoading(null);
      }
    },
    [invalidateAppointments, t],
  );

  const canEditBooking = useCallback(
    (booking: BookingRecord) => {
      const today = new Date().toISOString().slice(0, 10);
      const bookingDate = booking.appointment_date;
      return bookingDate >= today;
    },
    [],
  );

  const isBookingLate = useCallback(
    (booking: BookingRecord) => {
      const today = new Date().toISOString().slice(0, 10);
      if (booking.appointment_date !== today) return false;
      const now = new Date();
      const [h, m] = String(booking.appointment_time || "").split(":");
      const apptTime = new Date();
      apptTime.setHours(parseInt(h || "0"), parseInt(m || "0"), 0);
      const diffMinutes = Math.round(
        (now.getTime() - apptTime.getTime()) / (1000 * 60),
      );
      return diffMinutes > 60;
    },
    [],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, bookingId: string | number) => {
      e.dataTransfer.setData("text/plain", String(bookingId));
      e.dataTransfer.setData("bookingId", String(bookingId));
    },
    [],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetBarberId: string | number) => {
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
        toast.success(t("toasts.barberChanged"));
        invalidateAppointments();
      } catch (err) {
        toast.error(
          bookingApiErrorMessage(err, t("toasts.barberChangeFailed"), t("conflict.generic")),
        );
      } finally {
        setActionLoading(null);
      }
    },
    [invalidateAppointments],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleChangeBookingStatus = useCallback(
    async (booking: BookingRecord, newStatus: string) => {
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
        toast.success(t("toasts.statusUpdated"));
        invalidateAppointments();
      } catch (err) {
        toast.error(
          bookingApiErrorMessage(err, t("toasts.statusUpdateFailed"), t("conflict.generic")),
        );
      } finally {
        setActionLoading(null);
      }
    },
    [invalidateAppointments],
  );

  const confirmCancellation = useCallback(async () => {
    if (!bookingToCancel) return;
    try {
      setSaving(true);
      await api.patch(`/appointments/${bookingToCancel.id}/status`, {
        status: "cancelled",
        cancellation_reason: cancellationReason || t("toasts.noReasonGiven"),
      });
      toast.success(t("toasts.cancelled"));
      setIsCancelDialogOpen(false);
      setCancellationReason("");
      invalidateAppointments();
    } catch (err) {
      toast.error(
        bookingApiErrorMessage(err, t("toasts.cancelFailed"), t("conflict.generic")),
      );
    } finally {
      setSaving(false);
      setBookingToCancel(null);
    }
  }, [bookingToCancel, cancellationReason, invalidateAppointments, t]);

  const checkConflict = useCallback(
    async (empId: string | number, date: string, time: string) => {
      if (!empId || !date || !time) return;

      let duration = 30;
      if (formData.services && formData.services.length > 0) {
        duration = formData.services.reduce((sum: number, item: any) => {
          const s = services.find((srv: any) => srv.id === item.serviceId);
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
        // A failed conflict check used to pass silently, so the booking was
        // saved with no double-booking warning at all.
        console.error(e);
        setConflictMsg(t("toasts.conflictCheckFailed"));
      }
    },
    [formData.services, services, editingBooking?.id, t],
  );

  const checkCustomerDuplicate = useCallback(
    async (customerId: string | number, date: string, excludeId = null) => {
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
    },
    [],
  );

  const fetchAvailableSlots = useCallback(
    async (barberId: string | number, date: string) => {
      if (!barberId || !date) return;
      try {
        setSlotsError(null);
        const res = await api.get("/appointments/available-slots", {
          params: { barber_id: barberId, date: date },
        });
        setAvailableSlots(res.data);
      } catch (e) {
        // Previously the previous slot list was left in place, so a failed
        // refresh meant the barber could still pick a time that had just been
        // taken. Clear it and say so instead.
        console.error("Error fetching slots:", e);
        setAvailableSlots([]);
        setSlotsError(t("toasts.slotsLoadFailed"));
      }
    },
    [],
  );

  const calculateEndTime = useCallback(() => {
    if (!formData.appointmentTime || formData.services.length === 0)
      return null;

    const [h, m] = formData.appointmentTime.split(":").map(Number);
    const start = new Date();
    start.setHours(h, m, 0);

    const totalDuration = formData.services.reduce((sum: number, item: any) => {
      const s = services.find((srv: any) => srv.id === item.serviceId);
      return sum + Number(s?.duration_minutes || 30) * item.quantity;
    }, 0);

    const end = new Date(start.getTime() + totalDuration * 60000);
    return end.toTimeString().slice(0, 5);
  }, [formData.appointmentTime, formData.services, services]);

  const handlePhoneSearch = useCallback(
    async (phone: string) => {
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
    },
    [],
  );

  const onPhoneChange = useCallback(
    (value: string) => {
      // Egyptian mobile numbers are 11 digits; the cap is enforced here too so
      // a pasted longer value is trimmed even though maxLength guards typing.
      const val = String(value || "").replace(/\D/g, "").slice(0, 11);
      setFormData((prev: any) => ({ ...prev, customerPhone: val }));
      clearTimeout(phoneTimerRef.current);
      if (val.length < 8) {
        setCustomerSuggestions([]);
        return;
      }
      phoneTimerRef.current = setTimeout(() => {
        handlePhoneSearch(val);
      }, 350);
    },
    [handlePhoneSearch],
  );

  const selectSuggestedCustomer = useCallback(
    (customer: any) => {
      setFoundCustomer(customer);
      const cId = customer.customer_id || customer.id || customer.customerId;
      setFormData((prev: any) => {
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
      toast.success(
        t("toasts.pickedCustomer", {
          name: customer.first_name || customer.name,
        }),
      );
    },
    [checkCustomerDuplicate, editingBooking?.id, t],
  );

  const handleSaveBooking = useCallback(async () => {
    if (customerMode === "search")
      return toast.error(t("toasts.phoneRequiredSearch"));
    if (customerMode === "new" && !formData.customerName)
      return toast.error(t("toasts.nameRequired"));
    if (!formData.employeeId || formData.employeeId === "")
      return toast.error(t("toasts.barberRequired"));
    if (!formData.appointmentTime)
      return toast.error(t("toasts.timeRequired"));
    if (formData.services.length === 0)
      return toast.error(t("toasts.serviceRequired"));
    if (conflictMsg) return toast.error(conflictMsg);

    const today = new Date().toISOString().slice(0, 10);
    if (formData.appointmentDate < today)
      return toast.error(t("toasts.pastDateForbidden"));
    if (formData.appointmentDate === today) {
      const now = new Date();
      const [h, m] = formData.appointmentTime.split(":").map(Number);
      const apptTime = new Date();
      apptTime.setHours(h, m, 0);
      if (apptTime <= now) return toast.error(t("toasts.pastTimeForbidden"));
    }

    if (duplicateBooking)
      return toast.error(
        duplicateBooking.message || t("toasts.duplicateDefault"),
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
        services: formData.services.map((s: any) => ({
          service_id: s.serviceId,
          quantity: s.quantity,
        })),
      };

      if (editingBooking) {
        await api.patch(`/appointments/${editingBooking.id}`, payload);
        toast.success(t("toasts.updated"));
      } else {
        await api.post("/appointments", payload);
        toast.success(t("toasts.created"));
      }
      // The draft served its purpose; a fresh create starts truly fresh.
      writeBookingDraft(null);
      setIsModalOpen(false);
      invalidateAppointments();
    } catch (err) {
      toast.error(
        bookingApiErrorMessage(err, t("toasts.saveFailed"), t("conflict.generic")),
      );
    } finally {
      setSaving(false);
    }
  }, [
    customerMode,
    formData,
    conflictMsg,
    duplicateBooking,
    editingBooking,
    invalidateAppointments,
    t,
  ]);

  const openCreate = useCallback(() => {
    setEditingBooking(null);
    // Restore a previously saved create-draft so an accidental close never
    // loses a half-typed form. The date is always today; everything else
    // (name, phone, expert, time, services, notes) returns as it was.
    const draft = readBookingDraft();
    setFormData({
      ...emptyForm,
      ...(draft || {}),
      appointmentDate: TODAY,
    });
    if (draft) {
      setCustomerMode(draft.customerMode === "new" ? "new" : draft.foundCustomer ? "found" : "search");
      setFoundCustomer(draft.foundCustomer || null);
    } else {
      setCustomerMode("search");
      setFoundCustomer(null);
    }
    setConflictMsg("");
    setDuplicateBooking(null);
    setAvailableSlots([]);
    setIsModalOpen(true);
    setTimeout(() => phoneInputRef.current?.focus(), 100);
  }, []);

  const openEdit = useCallback(
    (b: BookingRecord) => {
      if (!canEditBooking(b)) {
        toast.error(t("toasts.pastEditForbidden"));
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
        services: (b.services || []).map((s: any) => ({
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
    },
    [canEditBooking, fetchAvailableSlots],
  );

  useEffect(() => {
    const target = location.state?.editAppointment;
    if (!target) return;
    const booking =
      bookings.find((b) => String(b.id) === String(target.id)) || target;
    openEdit(booking);
    window.history.replaceState({}, document.title);
  }, [location.state, bookings, openEdit]);

  const groupedServices = useMemo(() => {
    const groups: Record<string, any[]> = { all: [] };
    categories.forEach((cat: any) => {
      groups[cat.id] = [];
    });
    services.forEach((s: any) => {
      groups.all.push(s);
      const catId = s.category_id || s.categoryId;
      if (catId && groups[catId]) {
        groups[catId].push(s);
      }
    });
    return groups;
  }, [services, categories]);

  return {
    navigate,
    location,
    socket,
    connected,
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
    phoneInputRef,
    searchInputRef,
    isModalOpen,
    setIsModalOpen,
    isCancelDialogOpen,
    setIsCancelDialogOpen,
    bookingToCancel,
    setBookingToCancel,
    cancellationReason,
    setCancellationReason,
    editingBooking,
    setEditingBooking,
    saving,
    setSaving,
    actionLoading,
    setActionLoading,
    duplicateBooking,
    setDuplicateBooking,
    viewMode,
    setViewMode,
    formData,
    setFormData,
    customerMode,
    setCustomerMode,
    foundCustomer,
    setFoundCustomer,
    conflictMsg,
    setConflictMsg,
    selectedServiceCategory,
    setSelectedServiceCategory,
    customerSuggestions,
    setCustomerSuggestions,
    availableSlots,
    slotsError,
    setAvailableSlots,
    groupedServices,
    handleTransferToPOS,
    handleOpenCustomerProfile,
    handleActivateBooking,
    handleRescheduleBooking,
    canEditBooking,
    isBookingLate,
    handleDragStart,
    handleDrop,
    handleDragOver,
    handleChangeBookingStatus,
    confirmCancellation,
    checkConflict,
    checkCustomerDuplicate,
    fetchAvailableSlots,
    calculateEndTime,
    handlePhoneSearch,
    onPhoneChange,
    selectSuggestedCustomer,
    handleSaveBooking,
    openCreate,
    openEdit,
  };
}