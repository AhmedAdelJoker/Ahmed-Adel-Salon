import { useEffect, useMemo, useState, useRef } from "react";
import {
  Activity,
  Calendar,
  Clock,
  Edit3,
  Phone,
  Plus,
  Save,
  Search,
  X,
  ShoppingCart,
  LayoutGrid,
  Globe,
  ArrowUpRight,
  Sparkles,
  Zap,
  RefreshCw,
  Trash2,
  AlertTriangle,
  MessageCircle,
  TrendingUp,
  Filter,
  CheckCircle2,
  CreditCard,
  Users,
  UserPlus,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { useSocket } from "@/context/SocketContext";

import api from "@/services/api";
import { adaptList } from "@/services/apiAdapter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cn,
  formatTime12h,
  formatCurrency,
  getApiErrorMessage,
} from "@/lib/core/utils";
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { Skeleton } from "@/components/ui/skeleton";



import {
  TODAY,
  normalizeStatus,
  timeOnly,
  getExpectedEndTime,
  statusConfig,
  getBookingCustomerName,
  DATE_FILTERS,
  TAB_CATEGORIES,
  emptyForm,
  sendWhatsAppMessage,
  useBookingsBoard,
} from "@/features/bookings";


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

  return (
    <div
      className="erp-page space-y-6 sm:space-y-8 pb-12 overflow-x-hidden"
      dir="rtl"
    >
      {/* ── HEADER WITH ALL ACTION TEXTS ALWAYS VISIBLE ── */}
      <PageHeader className={undefined}
        title="إدارة الحجوزات"
        subtitle="منظومة الحجوزات الشاملة المربوطة بنقطة البيع، لوحة الاستقبال، وسجل العملاء."
        badge={connected ? "متصل مباشر" : "غير متصل"}
        icon={Calendar}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
            <Button
              variant="outline"
              onClick={() => navigate("/reception-board")}
              className="h-10 sm:h-11 px-3 text-xs font-black shadow-sm flex items-center gap-1.5 shrink-0"
              title="الذهاب للوحة الاستقبال المباشرة"
            >
              <Users size={16} className="text-indigo-500 shrink-0" />
              <span className="whitespace-nowrap">لوحة الاستقبال</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/pos")}
              className="h-10 sm:h-11 px-3 text-xs font-black shadow-sm flex items-center gap-1.5 shrink-0"
              title="نقطة البيع الكاشير"
            >
              <CreditCard size={16} className="text-emerald-500 shrink-0" />
              <span className="whitespace-nowrap">الكاشير (POS)</span>
            </Button>

            <Button
               
              variant={(viewMode === "board" ? "default" : "outline") as any}
              onClick={() =>
                setViewMode(viewMode === "grid" ? "board" : "grid")
              }
              className="h-10 sm:h-11 px-3 sm:px-4 text-xs font-black shadow-sm flex items-center gap-2 shrink-0"
            >
              {viewMode === "grid" ? (
                <LayoutGrid size={16} />
              ) : (
                <Activity size={16} />
              )}
              <span className="whitespace-nowrap">
                {viewMode === "grid" ? "عرض اللوحة" : "عرض الشبكة"}
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/schedule")}
              className="h-10 sm:h-11 px-3 sm:px-4 text-xs font-black shadow-sm flex items-center gap-2 shrink-0"
            >
              <Clock size={16} />
              <span className="whitespace-nowrap">المخطط الزمني</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsWalkInOpen(true)}
              className="h-10 sm:h-11 px-3 sm:px-5 text-xs font-black flex items-center gap-2 shrink-0 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            >
              <UserPlus size={16} />
              <span className="whitespace-nowrap">عميل مشاة</span>
            </Button>

            <Button
              onClick={openCreate}
              className="h-10 sm:h-11 px-5 sm:px-8 text-xs font-black shadow-accent flex items-center gap-2 shrink-0"
            >
              <Plus size={18} />
              <span className="whitespace-nowrap">حجز موعد جديد</span>
            </Button>
          </div>
        }
      />

      {/* ── SALON CAPACITY GAUGE ── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full -ml-32 -mt-32 blur-3xl" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm sm:text-base font-black">
                مؤشر إشغال الصالون اليوم
              </h3>
              <Badge
                className={cn(
                  "text-[10px] font-black border-none px-2 h-5",
                  salonCapacity.isBusy
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-emerald-500 text-white",
                )}
              >
                {salonCapacity.isBusy ? "فترة ذروة" : "نشاط طبيعي"}
              </Badge>
            </div>
            <p className="text-xs text-white/70 font-medium">
              تم حجز{" "}
              <span className="text-indigo-300 font-bold">
                {salonCapacity.activeCount} مواعيد
              </span>{" "}
              اليوم | نسبة الضغط التشغيلي:{" "}
              <span className="text-indigo-300 font-bold">
                {salonCapacity.percentage}%
              </span>
            </p>
          </div>
        </div>

        <div className="w-full md:w-72 space-y-2 relative z-10">
          <div className="flex justify-between items-center text-xs font-bold text-white/80">
            <span>سعة التشغيل</span>
            <span className="text-indigo-400">{salonCapacity.percentage}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden p-0.5">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                salonCapacity.percentage > 80
                  ? "bg-rose-500"
                  : salonCapacity.percentage > 50
                    ? "bg-amber-500"
                    : "bg-indigo-500",
              )}
              style={{ width: `${salonCapacity.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── STATS OVERVIEW (CLICKABLE INTERACTIVE CARDS) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div
          onClick={() => {
            setActiveTab("الكل");
            setQuickFilter("all");
          }}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <StatCard
            label="إجمالي المواعيد"
            value={stats.total}
            icon={Activity}
            variant="primary"
           trend={undefined} trendValue={undefined} />
        </div>

        <div
          onClick={() => {
            setActiveTab("أونلاين");
            setQuickFilter("all");
          }}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <StatCard
            label="حجوزات أونلاين"
            value={stats.online}
            icon={Globe}
            variant="info"
           trend={undefined} trendValue={undefined} />
        </div>

        <div
          onClick={() => {
            setActiveTab("بانتظار الخدمة");
            setQuickFilter("all");
          }}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <StatCard
            label="بانتظار الخدمة"
            value={stats.waiting}
            icon={Clock}
            variant="warning"
           trend={undefined} trendValue={undefined} />
        </div>

        <div
          onClick={() => {
            setActiveTab("عند الاستقبال");
            setQuickFilter("all");
          }}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <StatCard
            label="عند الاستقبال"
            value={stats.reception}
            icon={Sparkles}
            variant="success"
           trend={undefined} trendValue={undefined} />
        </div>

        <div
          onClick={() => {
            setActiveTab("الملغاة");
            setQuickFilter("all");
          }}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <StatCard
            label="حجوزات ملغاة"
            value={stats.cancelled}
            icon={X}
            variant="danger"
           trend={undefined} trendValue={undefined} />
        </div>
      </div>

      {/* ── MAIN CONTENT CARD & TOOLBAR ── */}
      <PremiumCard noPadding className={undefined}>
        {/* Responsive Toolbar with Horizontal Scroll Support */}
        <div className="p-4 sm:p-6 border-b border-border space-y-4">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64 md:w-72">
                <Search
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted/60"
                  size={16}
                />
                <Input
                  ref={searchInputRef}
                  placeholder="بحث باسم العميل أو الهاتف (/)..."
                  className="h-10 sm:h-11 pr-10 text-xs font-bold rounded-xl bg-soft/50 border-border focus:bg-card"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted hover:text-main"
                    aria-label="مسح البحث"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Barber Dropdown */}
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
              >
                <SelectTrigger className="h-10 sm:h-11 bg-soft/50 border-border font-bold text-xs rounded-xl w-full sm:w-48">
                  <SelectValue placeholder="كل الخبراء" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-premium">
                  <SelectItem value="all" className="font-bold text-xs py-2.5">
                    كل الخبراء
                  </SelectItem>
                  {employees.map((emp) => (
                    <SelectItem
                      key={emp.id}
                      value={String(emp.id)}
                      className="font-bold text-xs py-2.5"
                    >
                      {emp.display_name || emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Right Controls: Date Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-end">
              <div className="flex items-center flex-wrap gap-1 bg-soft p-1 rounded-xl border border-border">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setDateFilter(f.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap",
                      dateFilter === f.id
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted hover:text-main",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <div className="flex items-center gap-2 bg-soft/50 p-1.5 rounded-xl border border-border mt-2 sm:mt-0">
                  <Input
                    type="date"
                    className="h-8 px-2 text-xs font-bold w-32 bg-card rounded-lg"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-xs font-bold text-muted">إلى</span>
                  <Input
                    type="date"
                    className="h-8 px-2 text-xs font-bold w-32 bg-card rounded-lg"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status Tabs with Live Counters (wrap so all tabs stay visible) */}
          <div className="flex flex-wrap bg-soft p-1 rounded-xl border border-border w-full">
            {TAB_CATEGORIES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  setQuickFilter("all");
                }}
                className={cn(
                  "flex-1 min-w-[7rem] px-3 sm:px-4 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5",
                  activeTab === t.id
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted hover:text-main",
                )}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    "text-[10px] font-black px-1.5 py-0.5 rounded-md leading-none tabular-nums",
                    activeTab === t.id
                      ? "bg-primary/10 text-primary"
                      : "bg-soft/80 text-muted",
                  )}
                >
                  {tabCounts[t.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* SMART QUICK CHIPS FILTER ROW (wrap so all chips stay visible) */}
          <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-border/40">
            <span className="text-[10px] font-black text-muted uppercase flex items-center gap-1 shrink-0">
              <Filter size={12} /> فلترة سريعة:
            </span>

            {[
              { id: "all", label: "الكل" },
              { id: "walkin", label: "مشاة" },
              { id: "late", label: "المتأخرة" },
              { id: "pending", label: "قيد التأكيد" },
              { id: "online", label: "أونلاين" },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setQuickFilter(chip.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black transition-all whitespace-nowrap border",
                  quickFilter === chip.id
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-soft/60 text-muted border-border hover:border-primary/40 hover:text-main",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Live status strip: connection + last update + manual refresh */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div className="flex items-center gap-2 text-[11px] font-bold text-muted min-w-0">
              <span
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                  connected
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
                )}
              >
                {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                {connected ? "الاتصال الحي يعمل" : "إعادة الاتصال..."}
              </span>
              <span className="truncate">
                آخر تحديث:{" "}
                {lastUpdated.toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <Button
              variant="ghost"
              onClick={refreshBookings}
              disabled={refreshing}
              className="h-8 px-3 rounded-lg text-[11px] font-black text-muted hover:text-primary gap-1.5 shrink-0"
            >
              <RefreshCw
                size={13}
                className={cn(refreshing && "animate-spin")}
              />
              تحديث
            </Button>
          </div>
        </div>

        {/* View Grid / Board Content */}
        <div className="p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {appointmentsQuery.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[2rem] border border-border bg-card p-5 space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-11 w-11 rounded-xl" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-10 flex-1 rounded-xl" />
                      <Skeleton className="h-10 w-10 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                    {filteredBookings.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-muted bg-soft/20 rounded-3xl border border-dashed border-border/60 p-8 space-y-2">
                        <Calendar
                          size={40}
                          className="mx-auto text-muted/40 mb-2"
                        />
                        <p className="font-black text-sm text-main">
                          لم يتم العثور على أي مواعيد بهذه الفلاتر.
                        </p>
                        <p className="text-xs font-bold text-muted">
                          جرب تغيير الفلاتر أو تاريخ الحجز لعرض النتيجة.
                        </p>
                      </div>
                    ) : (
                      filteredBookings.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          onEdit={() => openEdit(b)}
                          onStatus={handleChangeBookingStatus}
                          onActivate={handleActivateBooking}
                          onTransferToPOS={handleTransferToPOS}
                          onOpenCustomer={handleOpenCustomerProfile}
                          onReschedule={(booking) => {
                            const newDate = prompt(
                              "أدخل التاريخ الجديد (YYYY-MM-DD):",
                              booking.appointment_date,
                            );
                            const newTime = prompt(
                              "أدخل الوقت الجديد (HH:MM):",
                              booking.appointment_time,
                            );
                            if (newDate && newTime)
                              handleRescheduleBooking(
                                booking,
                                newDate,
                                newTime,
                              );
                          }}
                          canEdit={canEditBooking(b)}
                          loading={actionLoading}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  /* Board / Kanban View (snap-scroll on mobile, no double scroll) */
                  <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                    {employees.map((emp) => {
                      const empBookings = filteredBookings.filter(
                        (b) => b.barber_id === emp.id,
                      );
                      const empRevenue = empBookings.reduce(
                        (sum, b) => sum + Number(b.total_estimated_price || 0),
                        0,
                      );
                      return (
                        <div
                          key={emp.id}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, emp.id)}
                          className="flex-shrink-0 w-[80vw] xs:w-72 sm:w-80 snap-center flex flex-col bg-soft/40 p-4 rounded-[2rem] border border-border/60 transition-all hover:bg-soft/70 shadow-sm h-[calc(100dvh-31rem)] min-h-[22rem]"
                        >
                          <div className="flex items-center justify-between p-2 border-b border-border/40 pb-3 shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <EmployeeAvatar
                                name={emp.display_name || emp.full_name}
                                size="sm"
                               imageUrl={undefined} role={undefined} className={undefined} />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black text-main truncate">
                                  {emp.display_name || emp.full_name}
                                </span>
                                <span className="text-[11px] font-bold text-muted">
                                  {empBookings.length} حجوزات
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-card text-[11px] font-black shrink-0"
                            >
                              {empBookings.length}
                            </Badge>
                          </div>

                          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar p-1 min-h-0">
                            {empBookings.length === 0 ? (
                              <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-2xl text-muted/60 space-y-1">
                                <Clock
                                  size={24}
                                  className="mx-auto opacity-30 mb-1"
                                />
                                <p className="text-xs font-bold">
                                  لا توجد حجوزات حالياً
                                </p>
                              </div>
                            ) : (
                              empBookings.map((b) => (
                                <div
                                  key={b.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, b.id)}
                                  className="bg-card p-4 rounded-2xl border border-border shadow-sm cursor-grab active:cursor-grabbing transition-all hover:shadow-md group relative space-y-3"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-xs font-black text-main break-words min-w-0">
                                      {getBookingCustomerName(b)}
                                    </span>
                                    <Badge className="text-[11px] font-black h-5 px-2 bg-primary text-white border-none shrink-0 dir-ltr">
                                      {formatTime12h(
                                        timeOnly(b.appointment_time),
                                      )}
                                    </Badge>
                                  </div>

                                  <div className="flex items-center justify-between text-muted text-[11px] font-bold border-t border-b border-border/30 py-2 gap-2">
                                    <span className="flex items-center gap-1 min-w-0 truncate">
                                      <Calendar size={12} />{" "}
                                      {b.appointment_date}
                                    </span>
                                    <span className="flex items-center gap-1 text-primary shrink-0">
                                      <Clock size={12} />{" "}
                                      {b.total_estimated_duration_minutes || 30}{" "}
                                      د
                                    </span>
                                  </div>

                                  <div className="flex justify-between items-center gap-2 pt-1">
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar min-w-0">
                                      {b.services?.map((s, i) => (
                                        <span
                                          key={i}
                                          className="text-[10px] font-bold px-2 py-0.5 bg-soft rounded-md text-muted"
                                        >
                                          {s.service_name_snapshot || "خدمة"}
                                        </span>
                                      ))}
                                    </div>
                                    <button
                                      onClick={() => openEdit(b)}
                                      className="p-1.5 rounded-lg bg-soft text-muted hover:bg-primary hover:text-white transition-all shrink-0"
                                      title="تعديل الحجز"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="pt-3 mt-1 border-t border-border/40 flex items-center justify-between text-[11px] font-black text-muted shrink-0">
                            <span>إيراد متوقع</span>
                            <span className="text-primary tabular-nums">
                              {empRevenue.toLocaleString("en-EG")} ج.م
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PremiumCard>

      {/* ── ADVANCED BOOKING MODAL (RESPONSIVE DIALOG) ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-4xl w-[95vw] sm:w-full rounded-[2rem] p-0 border-0 bg-card shadow-premium overflow-hidden flex flex-col max-h-[90vh]"
          dir="rtl"
        >
          {/* Modal Header */}
          <DialogHeader className="p-6 sm:p-8 pb-5 bg-gradient-to-br from-accent to-accent-strong relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <DialogTitle className="text-xl sm:text-2xl font-black text-white relative z-10 flex items-center gap-3 leading-none">
              <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
                <Zap size={20} fill="currentColor" />
              </div>
              <span>
                {editingBooking ? "تعديل بيانات الحجز" : "تسجيل حجز جديد"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/70 font-medium text-xs sm:text-sm mt-1.5">
              منظومة الحجز الذكية: بحث بالرقم، كشف تضارب، وتنظيم الخدمات بحرفية.
            </DialogDescription>
          </DialogHeader>

          {/* Modal Form Scrollable Area */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 overflow-y-auto custom-scrollbar flex-1">
            {/* Left Column: Customer & Timing Details */}
            <div className="space-y-6">
              {/* Customer Phone Search */}
              <div className="space-y-3">
                <label className="text-xs font-black text-muted uppercase tracking-wider block">
                  رقم هاتف العميل
                </label>
                <div className="relative w-full">
                  <Input
                    ref={phoneInputRef}
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    dir="ltr"
                    className="h-12 sm:h-14 rounded-2xl bg-soft border-border focus:bg-card font-black text-lg text-center"
                    value={formData.customerPhone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                  />

                  {/* Phone Suggestions Popup */}
                  {customerSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-2xl shadow-premium overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                      {customerSuggestions.map((cus) => (
                        <button
                          key={cus.customer_id}
                          onClick={() => selectSuggestedCustomer(cus)}
                          className="w-full p-3 text-right flex items-center gap-3 hover:bg-soft border-b border-border/40 last:border-0 transition-colors"
                        >
                          <EmployeeAvatar name={cus.first_name} size="xs"  imageUrl={undefined} role={undefined} className={undefined} />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-main truncate">
                              {cus.first_name} {cus.last_name}
                            </span>
                            <span className="text-[11px] font-bold text-muted dir-ltr">
                              {cus.phone}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer Found State */}
                <AnimatePresence mode="wait">
                  {customerMode === "found" && foundCustomer && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-accent/5 border border-emerald-500/20 flex items-center gap-4 shadow-sm relative overflow-hidden"
                    >
                      <EmployeeAvatar
                        name={foundCustomer.first_name || foundCustomer.name}
                        size="md"
                        className="ring-2 ring-emerald-500/30 shrink-0"
                       imageUrl={undefined} role={undefined} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            العميل المسجل
                          </p>
                          {foundCustomer.visit_count > 10 && (
                            <Badge className="bg-amber-500 text-white text-[10px] font-black px-1.5 h-4 border-none">
                              VIP
                            </Badge>
                          )}
                        </div>
                        <h5 className="text-base font-black text-main break-words">
                          {foundCustomer.first_name || foundCustomer.name}
                        </h5>
                        <p className="text-xs font-bold text-muted flex items-center gap-1 dir-ltr justify-end">
                          <Phone size={11} /> {foundCustomer.phone}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {customerMode === "new" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-2xl bg-accent/5 border-2 border-dashed border-accent/30 space-y-3"
                    >
                      <p className="text-xs font-black text-accent flex items-center gap-2">
                        <Sparkles size={14} /> عميل جديد! أدخل البيانات
                        الأساسية:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          placeholder="الاسم الأول..."
                          className="h-11 rounded-xl bg-card border-border font-bold text-xs"
                          value={formData.customerName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customerName: e.target.value,
                            })
                          }
                        />
                        <Input
                          placeholder="اسم العائلة..."
                          className="h-11 rounded-xl bg-card border-border font-bold text-xs"
                          value={formData.customerLastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customerLastName: e.target.value,
                            })
                          }
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {duplicateBooking && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-2.5 text-xs font-bold">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black">{duplicateBooking.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time Selection */}
              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted uppercase">
                      التاريخ
                    </label>
                    <Input
                      type="date"
                      min={TODAY}
                      className="h-11 rounded-xl bg-soft border-border font-black text-xs px-3"
                      value={formData.appointmentDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({ ...formData, appointmentDate: newDate });
                        checkConflict(
                          formData.employeeId,
                          newDate,
                          formData.appointmentTime,
                        );
                        checkCustomerDuplicate(
                          formData.customerId,
                          newDate,
                          editingBooking?.id,
                        );
                        fetchAvailableSlots(formData.employeeId, newDate);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-muted uppercase">
                        تحديد الموعد
                      </label>
                      {formData.appointmentTime && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const [h, m] = formData.appointmentTime
                                .split(":")
                                .map(Number);
                              const d = new Date();
                              d.setHours(h, m - 15);
                              const newTime = d.toTimeString().slice(0, 5);
                              setFormData({
                                ...formData,
                                appointmentTime: newTime,
                              });
                              checkConflict(
                                formData.employeeId,
                                formData.appointmentDate,
                                newTime,
                              );
                            }}
                            className="h-6 px-2 rounded-md bg-soft text-main hover:text-accent text-[11px] font-black border border-border"
                          >
                            -15 دقيقة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const [h, m] = formData.appointmentTime
                                .split(":")
                                .map(Number);
                              const d = new Date();
                              d.setHours(h, m + 15);
                              const newTime = d.toTimeString().slice(0, 5);
                              setFormData({
                                ...formData,
                                appointmentTime: newTime,
                              });
                              checkConflict(
                                formData.employeeId,
                                formData.appointmentDate,
                                newTime,
                              );
                            }}
                            className="h-6 px-2 rounded-md bg-soft text-main hover:text-accent text-[11px] font-black border border-border"
                          >
                            +15 دقيقة
                          </button>
                        </div>
                      )}
                    </div>

                    {availableSlots.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-1 border border-border/40 rounded-xl bg-soft/30">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                appointmentTime: slot.time,
                              });
                              checkConflict(
                                formData.employeeId,
                                formData.appointmentDate,
                                slot.time,
                              );
                            }}
                            className={cn(
                              "p-2 rounded-lg text-xs font-black border transition-all text-center dir-ltr",
                              formData.appointmentTime === slot.time
                                ? "bg-accent border-accent text-white shadow-sm"
                                : slot.available
                                  ? "bg-card border-border text-main hover:border-accent"
                                  : "bg-soft text-muted border-transparent opacity-40 cursor-not-allowed",
                            )}
                            disabled={!slot.available}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Input
                        type="time"
                        className="h-11 rounded-xl bg-soft border-border font-black text-xs px-3"
                        value={formData.appointmentTime}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            appointmentTime: e.target.value,
                          });
                          checkConflict(
                            formData.employeeId,
                            formData.appointmentDate,
                            e.target.value,
                          );
                        }}
                      />
                    )}
                  </div>
                </div>

                {formData.appointmentTime && (
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between text-xs font-bold text-main">
                    <span className="flex items-center gap-1.5 text-accent font-black">
                      <Clock size={14} /> النهاية المتوقعة:
                    </span>
                    <span className="font-black text-accent dir-ltr">
                      {calculateEndTime() || "جاري الحساب..."}
                    </span>
                  </div>
                )}

                {/* Barber Select */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted uppercase">
                    الخبير المسؤول
                  </label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(v) => {
                      setFormData({ ...formData, employeeId: v });
                      checkConflict(
                        v,
                        formData.appointmentDate,
                        formData.appointmentTime,
                      );
                      fetchAvailableSlots(v, formData.appointmentDate);
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-12 rounded-xl bg-soft border-border font-bold text-xs",
                        conflictMsg &&
                          "border-rose-500 bg-rose-50 dark:bg-rose-950/20",
                      )}
                    >
                      <SelectValue placeholder="اختر الخبير..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-premium">
                      {employees.map((e) => (
                        <SelectItem
                          key={e.id}
                          value={String(e.id)}
                          className="font-bold text-xs py-2.5"
                        >
                          {e.display_name || e.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {conflictMsg && (
                    <p className="text-xs font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                      <AlertTriangle size={14} /> {conflictMsg}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Service Selection & Notes */}
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-muted uppercase tracking-wider block">
                  اختيار الخدمات
                </label>

                {/* Category Tabs */}
                <Tabs
                  value={selectedServiceCategory}
                  onValueChange={setSelectedServiceCategory}
                  className="w-full"
                >
                  <TabsList className="bg-soft p-1 rounded-xl flex overflow-x-auto no-scrollbar gap-1 mb-3 h-auto border border-border">
                    <TabsTrigger
                      value="all"
                      className="rounded-lg px-3 py-1.5 text-xs font-black data-[state=active]:bg-card data-[state=active]:text-primary"
                    >
                      الكل
                    </TabsTrigger>
                    {categories.map((c) => (
                      <TabsTrigger
                        key={c.id}
                        value={String(c.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-black data-[state=active]:bg-card"
                      >
                        {c.name_ar || c.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* Services Grid */}
                  <div className="bg-soft/40 rounded-2xl border border-border p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                      {(groupedServices[selectedServiceCategory] || []).map(
                        (s) => {
                          const active = formData.services.some(
                            (item) => item.serviceId === s.id,
                          );
                          return (
                            <button
                              key={s.id}
                              onClick={() => {
                                if (active)
                                  setFormData({
                                    ...formData,
                                    services: formData.services.filter(
                                      (i) => i.serviceId !== s.id,
                                    ),
                                  });
                                else
                                  setFormData({
                                    ...formData,
                                    services: [
                                      ...formData.services,
                                      { serviceId: s.id, quantity: 1 },
                                    ],
                                  });
                              }}
                              className={cn(
                                "p-3 rounded-xl text-xs font-black border transition-all text-right flex items-center justify-between gap-2",
                                active
                                  ? "bg-accent border-accent text-white shadow-md"
                                  : "bg-card border-border/60 text-main hover:border-accent/50",
                              )}
                            >
                              <span className="break-words min-w-0">
                                {s.name_ar || s.name}
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-bold shrink-0",
                                  active ? "text-white" : "text-accent",
                                )}
                              >
                                {s.price} ج.م
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>

                    {/* Cost Summary Box */}
                    <div className="pt-3 border-t border-border/40 flex justify-between items-center">
                      <div>
                        <p className="text-[11px] font-black text-muted uppercase">
                          المبلغ المتوقع
                        </p>
                        <p className="text-2xl font-black text-accent tabular-nums">
                          {formData.services.reduce((sum, item) => {
                            const s = services.find(
                              (srv) => srv.id === item.serviceId,
                            );
                            return sum + Number(s?.price || 0);
                          }, 0)}{" "}
                          <span className="text-xs font-bold opacity-60">
                            ج.م
                          </span>
                        </p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                        <ShoppingCart size={20} />
                      </div>
                    </div>
                  </div>
                </Tabs>
              </div>

              {/* Special Notes */}
              <div className="space-y-2">
                <label className="text-xs font-black text-muted uppercase tracking-wider block">
                  ملاحظات خاصة
                </label>
                <textarea
                  placeholder="أي رغبات إضافية للعميل..."
                  className="w-full h-20 rounded-xl bg-soft border border-border p-3 font-bold text-xs focus:bg-card focus:border-accent outline-none resize-none transition-all"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <DialogFooter className="p-4 sm:p-6 bg-soft/40 border-t border-border/50 flex flex-row items-center justify-between gap-3 shrink-0">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl font-black px-6 h-11 text-xs"
            >
              إلغاء الأمر
            </Button>
            <Button
              onClick={handleSaveBooking}
              loading={saving}
              disabled={conflictMsg !== "" || customerMode === "search"}
              className="rounded-xl font-black px-8 h-11 shadow-accent text-xs flex items-center gap-2"
            >
              <Save size={16} />
              <span>
                {editingBooking ? "حفظ التعديلات" : "تأكيد وتسجيل الحجز"}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── WALK-IN CUSTOMER MODAL ── */}
      <Dialog
        open={isWalkInOpen}
        onOpenChange={(open) => {
          if (!open) {
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
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-2xl" dir="rtl">
          <DialogHeader className="p-5 pb-3 border-b border-border/40">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserPlus size={16} className="text-emerald-600" />
              </div>
              تسجيل عميل مشاة (Walk-in)
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted">
              سجّل العميل بسرعة وسينتقل تلقائياً للاستقبال
            </DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Customer Search/Create */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                رقم الهاتف
              </label>
              <div className="relative">
                <Input
                  value={walkInData.phone}
                  onChange={(e) => handleWalkInPhoneSearch(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="h-10 rounded-xl bg-soft border-border font-bold"
                  dir="ltr"
                />
                {walkInSuggestions.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-lg border border-border bg-card shadow-lg max-h-32 overflow-y-auto">
                    {walkInSuggestions.map((c) => (
                      <button
                        key={c.customer_id || c.id}
                        type="button"
                        onClick={() => selectWalkInCustomer(c)}
                        className="w-full text-right p-2 hover:bg-soft text-xs font-bold"
                      >
                        {c.first_name || c.name} {c.last_name || ""} - {c.phone}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {walkInCustomer && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5">
                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                  ✓ تم العثور على العميل: {walkInCustomer.first_name}{" "}
                  {walkInCustomer.last_name || ""}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  الاسم الأول *
                </label>
                <Input
                  value={walkInData.firstName}
                  onChange={(e) =>
                    setWalkInData({ ...walkInData, firstName: e.target.value })
                  }
                  placeholder="الاسم"
                  className="h-10 rounded-xl bg-soft border-border font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  اسم العائلة
                </label>
                <Input
                  value={walkInData.lastName}
                  onChange={(e) =>
                    setWalkInData({ ...walkInData, lastName: e.target.value })
                  }
                  placeholder="العائلة"
                  className="h-10 rounded-xl bg-soft border-border font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                الخبير *
              </label>
              <Select
                value={walkInData.employeeId}
                onValueChange={(v) =>
                  setWalkInData({ ...walkInData, employeeId: v })
                }
              >
                <SelectTrigger className="h-10 rounded-xl bg-soft border-border font-bold">
                  <SelectValue placeholder="اختر الخبير..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="font-bold text-xs">
                    توزيع تلقائي
                  </SelectItem>
                  {employees.map((emp) => (
                    <SelectItem
                      key={emp.id}
                      value={String(emp.id)}
                      className="font-bold text-xs"
                    >
                      {emp.display_name || emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                الخدمات *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto rounded-lg border border-border bg-soft p-2">
                {services.map((srv) => {
                  const isSelected = walkInData.serviceIds.includes(srv.id);
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() =>
                        setWalkInData({
                          ...walkInData,
                          serviceIds: isSelected
                            ? walkInData.serviceIds.filter(
                                (id) => id !== srv.id,
                              )
                            : [...walkInData.serviceIds, srv.id],
                        })
                      }
                      className={cn(
                        "p-2 rounded-lg border text-right text-[10px] font-bold transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-muted hover:border-primary/30",
                      )}
                    >
                      <span className="block truncate">{srv.name}</span>
                      <span className="text-[8px] text-muted">
                        {formatCurrency(srv.price || srv.base_price || 0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                ملاحظات
              </label>
              <input
                value={walkInData.notes}
                onChange={(e) =>
                  setWalkInData({ ...walkInData, notes: e.target.value })
                }
                placeholder="أي ملاحظات..."
                className="w-full h-10 rounded-xl border border-border bg-soft px-3 text-xs font-bold focus:border-primary focus:ring-0"
              />
            </div>
          </div>
          <DialogFooter className="p-5 pt-3 border-t border-border/40 gap-2">
            <Button
              variant="outline"
              onClick={() => {
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
              }}
              className="h-10 flex-1 rounded-xl text-xs"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleWalkInSubmit}
              loading={walkInSaving}
              disabled={
                !walkInData.firstName.trim() ||
                !walkInData.phone.trim() ||
                walkInData.serviceIds.length === 0
              }
              className="h-10 flex-1 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              <UserPlus size={14} className="ml-1.5" /> تسجيل ودخول الاستقبال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent
          className="max-w-md rounded-[2rem] p-0 border-0 bg-card shadow-premium overflow-hidden"
          dir="rtl"
        >
          <div className="p-6 bg-rose-600 relative overflow-hidden text-center text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 relative z-10">
              <AlertTriangle size={28} className="text-white" />
            </div>
            <DialogTitle className="text-lg font-black relative z-10 mb-1">
              تأكيد إلغاء الحجز
            </DialogTitle>
            <p className="text-white/80 text-xs font-medium relative z-10">
              يرجى تحديد سبب الإلغاء لضمان دقة البيانات والتحليلات.
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-3.5 rounded-xl bg-soft border border-border/50">
              <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                العميل
              </p>
              <p className="font-bold text-xs text-main break-words">
                {getBookingCustomerName(bookingToCancel)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-soft border border-border/50">
                <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                  التاريخ
                </p>
                <p className="font-bold text-xs text-main">
                  {bookingToCancel?.appointment_date}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-soft border border-border/50">
                <p className="text-[11px] font-black text-muted uppercase mb-0.5">
                  الوقت
                </p>
                <p className="font-bold text-xs text-main dir-ltr text-right">
                  {formatTime12h(timeOnly(bookingToCancel?.appointment_time))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-muted uppercase block">
                سبب الإلغاء
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["تغيير الموعد", "حالة طارئة", "عدم الرد", "أخرى"].map(
                  (reason) => (
                    <button
                      key={reason}
                      onClick={() => setCancellationReason(reason)}
                      className={cn(
                        "p-2.5 rounded-xl text-xs font-bold border transition-all text-center",
                        cancellationReason === reason
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                          : "bg-card text-muted border-border hover:border-rose-300",
                      )}
                    >
                      {reason}
                    </button>
                  ),
                )}
              </div>
              {cancellationReason === "أخرى" && (
                <Input
                  placeholder="يرجى كتابة السبب..."
                  className="h-10 rounded-xl bg-soft border-border text-xs mt-2"
                  value={
                    cancellationReason === "أخرى" ? "" : cancellationReason
                  }
                  onChange={(e) => setCancellationReason(e.target.value)}
                  onFocus={() => setCancellationReason("")}
                />
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-0 flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsCancelDialogOpen(false)}
              className="flex-1 rounded-xl font-black text-xs h-11"
            >
              تراجع
            </Button>
            <Button
              onClick={confirmCancellation}
              loading={saving}
              disabled={!cancellationReason}
              className={cn(
                "flex-1 rounded-xl font-black text-xs h-11 shadow-md",
                cancellationReason
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── REDESIGNED BOOKING CARD WITH EXPANDABLE SERVICES & ZERO DATA LOSS ── */
function BookingCard({
  booking,
  onEdit,
  onStatus,
  onActivate,
  onTransferToPOS,
  onOpenCustomer,
  onReschedule,
  canEdit,
  loading,
}: any) {
  const [showAllServices, setShowAllServices] = useState(false);
  const config = statusConfig(booking.status);
  const status = normalizeStatus(booking.status);
  const isOnline = booking.booking_source === "online";
  const isWalkIn = booking.booking_source === "walkin";

  const isToday = booking.appointment_date === TODAY;
  const now = new Date();
  const [h, m] = String(booking.appointment_time || "").split(":");
  const apptTime = new Date();
  apptTime.setHours(parseInt(h || "0"), parseInt(m || "0"), 0);

  const diffMinutes = Math.round((apptTime.getTime() - now.getTime()) / (1000 * 60));
  const isLate =
    isToday &&
    diffMinutes < 0 &&
    (status === "WAITING" || status === "CONFIRMED");
  const isLateHour = isLate && Math.abs(diffMinutes) > 60; // More than 1 hour late
  const isSoon =
    isToday &&
    diffMinutes > 0 &&
    diffMinutes <= 15 &&
    (status === "WAITING" || status === "CONFIRMED");

  const duration = booking.total_estimated_duration_minutes || 30;
  const expectedEnd = formatTime12h(
    getExpectedEndTime(timeOnly(booking.appointment_time), duration),
  );
  const servicesList = booking.services || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative bg-card border border-border rounded-3xl p-4 sm:p-5 transition-all duration-300 hover:shadow-premium hover:border-primary/30 flex flex-col justify-between gap-3.5 overflow-x-hidden overflow-y-visible min-w-0",
        isLateHour &&
          "bg-rose-500/[0.05] border-rose-500/40 ring-2 ring-rose-500/30",
        isLate &&
          !isLateHour &&
          "bg-rose-500/[0.03] border-rose-500/30 ring-1 ring-rose-500/20",
        isSoon &&
          "bg-amber-500/[0.03] border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.08)]",
      )}
    >
      {/* Late Warning Banner */}
      {isLateHour && (
        <div className="absolute top-0 left-0 right-0 bg-rose-600 text-white text-[10px] font-black text-center py-1 rounded-t-3xl">
          ⚠ متأخر أكثر من ساعة - يحتاج تفعيل أو إعادة جدولة
        </div>
      )}
      {/* Background Glow */}
      <div
        className={cn(
          "absolute top-0 right-0 w-28 h-28 blur-2xl opacity-10 transition-all duration-500 group-hover:opacity-25 -mr-10 -mt-10 rounded-full pointer-events-none",
          isOnline ? "bg-sky-500" : "bg-primary",
        )}
      />

      {/* Row 1: Customer Header & Direct Links */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4
              onClick={() => onOpenCustomer(booking.customer_id)}
              className="text-sm sm:text-base font-black text-main group-hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
              title="عرض سجل العميل الكامل"
            >
              <span className="break-words leading-snug">
                {getBookingCustomerName(booking)}
              </span>
              <ExternalLink
                size={12}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0"
              />
            </h4>
            {booking.customer?.cancellation_count >= 3 && (
               
              <AlertTriangle
                size={14}
                className="text-amber-500 shrink-0"
                 
                {...({ title: "عميل غير ملتزم" } as any)}
              />
            )}
            {booking.visit_count > 10 && (
              <Badge className="bg-amber-500 text-white text-[10px] font-black px-1.5 h-4 border-none shrink-0">
                VIP
              </Badge>
            )}
          </div>

          {/* Phone & WhatsApp Quick Menu */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted dir-ltr text-right">
              {booking.customer_phone || "غير متوفر"}
            </span>

            {booking.customer_phone && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-6 px-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1 text-[11px] font-black shadow-sm"
                    title="خيارات الرسائل الفورية عبر واتساب"
                  >
                    <MessageCircle size={12} />
                    <span>واتساب</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="rounded-2xl p-1.5 shadow-premium border-border"
                >
                  <DropdownMenuItem
                    onClick={() => sendWhatsAppMessage(booking, "reminder")}
                    className="text-xs font-bold cursor-pointer py-2 flex items-center gap-2"
                  >
                    <Clock size={14} className="text-amber-500" />
                    <span>إرسال تذكير بالموعد</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => sendWhatsAppMessage(booking, "confirm")}
                    className="text-xs font-bold cursor-pointer py-2 flex items-center gap-2"
                  >
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span>إرسال تأكيد الحجز</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => sendWhatsAppMessage(booking, "thank_you")}
                    className="text-xs font-bold cursor-pointer py-2 flex items-center gap-2"
                  >
                    <Sparkles size={14} className="text-primary" />
                    <span>إرسال رسالة شكر بعد الزيارة</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Source Badge & Late Alert Badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isOnline && (
            <Badge
              variant="outline"
              className="text-[10px] font-black text-sky-600 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 px-2 h-5"
            >
              ONLINE
            </Badge>
          )}
          {isWalkIn && (
            <Badge
              variant="outline"
              className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 px-2 h-5"
            >
              مشاة
            </Badge>
          )}
          {isLate && (
            <Badge className="text-[10px] font-black bg-rose-600 text-white border-none px-1.5 h-4 animate-pulse">
              متأخر {Math.abs(diffMinutes)} دقيقة
            </Badge>
          )}
        </div>
      </div>

      {/* Row 2: Structured Timing Pill & Date */}
      <div className="space-y-1">
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black border transition-all dir-ltr gap-2",
            isLate
              ? "bg-rose-600 text-white border-rose-600 shadow-md"
              : "bg-soft/70 border-border/60 text-main",
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock
              size={13}
              className={isLate ? "text-white" : "text-primary"}
            />
            <span className="whitespace-nowrap">
              {formatTime12h(timeOnly(booking.appointment_time))}
            </span>
            <span className="opacity-50 shrink-0">→</span>
            <span className="whitespace-nowrap">{expectedEnd}</span>
          </div>
          <span className="text-[11px] opacity-70 dir-rtl shrink-0">
            ({duration} د)
          </span>
        </div>
        <div className="flex justify-between items-center text-[11px] font-bold text-muted px-1 gap-2">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <Calendar size={11} /> {booking.appointment_date}
          </span>
          {booking.total_estimated_price > 0 && (
            <span className="text-primary font-black tabular-nums shrink-0">
              {booking.total_estimated_price} ج.م
            </span>
          )}
        </div>
      </div>

      {/* Row 3: ALL Services List (Scrollable / Expandable - NO Hidden Services!) */}
      <div className="space-y-1 relative z-10 min-w-0">
        <div
          className={cn(
            "flex flex-wrap gap-1.5 transition-all",
            !showAllServices && servicesList.length > 3
              ? "max-h-24 overflow-y-auto custom-scrollbar p-0.5"
              : "max-h-none",
          )}
        >
          {servicesList.map((s, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="rounded-lg py-0.5 px-2 bg-soft border border-border/40 text-[11px] font-bold text-muted h-6 flex items-center"
            >
              {s.service_name_snapshot || "خدمة"}
            </Badge>
          ))}
        </div>

        {servicesList.length > 3 && (
          <button
            onClick={() => setShowAllServices(!showAllServices)}
            className="text-[11px] font-black text-primary hover:underline flex items-center gap-0.5 pt-0.5"
          >
            {showAllServices ? (
              <>
                <span>عرض أقل</span> <ChevronUp size={10} />
              </>
            ) : (
              <>
                <span>عرض كافة الخدمات ({servicesList.length})</span>{" "}
                <ChevronDown size={10} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Row 4: Barber Info & Status */}
      <div className="p-2.5 rounded-xl bg-soft/40 border border-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <EmployeeAvatar
            name={booking.barber_name}
            size="xs"
            className="h-7 w-7 rounded-lg border border-white shadow-sm shrink-0"
           imageUrl={undefined} role={undefined} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted leading-none mb-0.5">
              الخبير المسؤول
            </p>
            <p className="text-xs font-black text-main break-words leading-tight">
              {booking.barber_name || "غير محدد"}
            </p>
          </div>
        </div>

        <Badge
          className={cn(
            "rounded-lg px-2 py-0.5 text-[10px] font-black border shrink-0",
            config.bg,
            config.color,
          )}
        >
          {config.label}
        </Badge>
      </div>

      {/* Row 5: Dynamic Integrated Actions (POS / Activation / Edit) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2">
          {status !== "DONE" && status !== "CANCELLED" ? (
            <>
              {status === "WAITING" || status === "CONFIRMED" ? (
                <Button
                  onClick={() => onActivate(booking)}
                  loading={loading === `${booking.id}-activate`}
                  className="flex-1 h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 min-w-0"
                >
                  <span className="whitespace-nowrap">
                    تفعيل ونقل للاستقبال
                  </span>
                  <ArrowUpRight size={14} className="shrink-0" />
                </Button>
              ) : (
                <Button
                  onClick={() => onTransferToPOS(booking)}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 min-w-0"
                >
                  <CreditCard size={14} className="shrink-0" />
                  <span className="whitespace-nowrap">تحويل لـ POS والدفع</span>
                </Button>
              )}

              <div className="flex gap-1 shrink-0">
                {canEdit && (
                  <Button
                    variant="ghost"
                    onClick={onEdit}
                    className="h-10 w-10 p-0 rounded-xl bg-soft text-muted hover:bg-card hover:text-primary border border-border/50"
                    title="تعديل الحجز"
                  >
                    <Edit3 size={15} />
                  </Button>
                )}
                {isLateHour && onReschedule && (
                  <Button
                    variant="ghost"
                    onClick={() => onReschedule(booking)}
                    className="h-10 w-10 p-0 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white border border-amber-500/20"
                    title="إعادة جدولة"
                  >
                    <Calendar size={15} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => onStatus(booking, "CANCELLED")}
                  className="h-10 w-10 p-0 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20"
                  title="إلغاء الحجز"
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center h-10 rounded-xl bg-soft/40 border border-dashed border-border text-xs font-black text-muted">
              {status === "DONE" ? "حجز مكتمل ومغلق" : "حجز ملغي"}
            </div>
          )}
        </div>
        {!canEdit && status !== "DONE" && status !== "CANCELLED" && (
          <p className="text-[9px] font-bold text-rose-500 text-center">
            لا يمكن تعديل حجز يوم سابق - أنشئ حجز جديد
          </p>
        )}
      </div>
    </motion.div>
  );
}
