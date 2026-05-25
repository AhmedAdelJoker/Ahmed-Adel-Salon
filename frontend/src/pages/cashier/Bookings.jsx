import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  User as UserIcon,
  User,
  ShoppingCart,
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
  Banknote,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useSocket } from "../../context/SocketContext";
import api from "../../services/api";
import { adaptList, adaptItem } from "../../services/apiAdapter";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { EmployeeAvatar } from "../../components/shared/EmployeeAvatar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";

const TODAY = new Date().toISOString().slice(0, 10);

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");

const normalizeStatus = (status) => {
  const value = String(status || "").toUpperCase();
  const map = {
    PENDING: "WAITING",
    SCHEDULED: "WAITING",
    WAITING: "WAITING",
    CONFIRMED: "CONFIRMED",
    IN_PROGRESS: "IN_PROGRESS",
    STARTED: "IN_PROGRESS",
    IN_SERVICE: "IN_PROGRESS",
    READY_FOR_PAYMENT: "READY_FOR_PAYMENT",
    COMPLETED: "DONE",
    DONE: "DONE",
    INVOICED: "INVOICED",
    CANCELLED: "CANCELLED",
    CANCELED: "CANCELLED",
    ARCHIVED: "ARCHIVED",
  };
  return map[value] || value || "WAITING";
};

const statusConfig = (status) => {
  const normalized = normalizeStatus(status);
  return (
    {
      WAITING: { label: "قادم", variant: "info" },
      CONFIRMED: { label: "مؤكد", variant: "warning" },
      IN_PROGRESS: { label: "قيد التنفيذ", variant: "accent" },
      READY_FOR_PAYMENT: { label: "جاهز للدفع", variant: "successSoft" },
      DONE: { label: "مكتمل", variant: "success" },
      INVOICED: { label: "مفوتر", variant: "outline" },
      CANCELLED: { label: "ملغي", variant: "danger" },
      ARCHIVED: { label: "مؤرشف", variant: "secondary" },
    }[normalized] || { label: normalized, variant: "outline" }
  );
};

const getId = (item) =>
  item?.id ??
  item?.customer_id ??
  item?.customerId ??
  item?.employee_id ??
  item?.employeeId ??
  item?.service_id ??
  item?.serviceId;

const getCustomerName = (customer) =>
  `${customer?.first_name || customer?.firstName || ""} ${customer?.last_name || customer?.lastName || ""}`.trim() ||
  customer?.name ||
  `عميل #${getId(customer) || ""}`;

const getEmployeeName = (employee) =>
  employee?.display_name ||
  employee?.full_name ||
  employee?.fullName ||
  employee?.name ||
  `خبير #${getId(employee) || ""}`;

const getServiceName = (service) =>
  service?.name_ar ||
  service?.name ||
  service?.display_name ||
  `خدمة #${getId(service) || ""}`;

const DATE_FILTERS = [
  { id: "today", label: "اليوم" },
  { id: "tomorrow", label: "غداً" },
  { id: "this_week", label: "هذا الأسبوع" },
  { id: "this_month", label: "هذا الشهر" },
  { id: "custom", label: "فترة مخصصة" },
  { id: "all", label: "الكل" },
  { id: "archive", label: "الأرشيف" },
];

const emptyForm = {
  customerId: "",
  employeeId: "",
  appointmentDate: TODAY,
  appointmentTime: "",
  notes: "",
  services: [],
};

export default function Bookings() {
  const socketContext = useSocket?.();
  const socket = socketContext?.socket || null;

  const { user } = useAuth();
  const role = user?.role?.toUpperCase() || "CASHIER";
  const myEmployeeId = user?.employee_id || user?.employeeId;

  // States
  const [bookings, setBookings] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [byBarberData, setByBarberData] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [viewMode, setViewMode] = useState("list"); // 'list', 'barber'
  const [activeTab, setActiveTab] = useState("الكل");
  const [dateFilter, setDateFilter] = useState("today");
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [serviceToAdd, setServiceToAdd] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("all");
  const [customerMode, setCustomerMode] = useState("existing");
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    phone: "",
    phone2: "",
  });

  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeUpcomingBookings = Array.isArray(upcomingBookings)
    ? upcomingBookings
    : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeServices = Array.isArray(services) ? services : [];

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        date_filter: dateFilter,
        limit: 1000,
      };
      if (dateFilter === "custom") {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      if (role === "BARBER" && myEmployeeId) {
        params.employee_id = myEmployeeId;
      }

      const response = await api.get("/appointments", { params });
      setBookings(adaptList(response));
    } catch (error) {
      console.error("Load bookings error:", error);
      toast.error("فشل تحميل الحجوزات");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, startDate, endDate, role, myEmployeeId]);

  const loadUpcoming = useCallback(async () => {
    try {
      const response = await api.get("/appointments/upcoming");
      setUpcomingBookings(adaptList(response));
    } catch (error) {
      console.error("Load upcoming error:", error);
    }
  }, []);

  const loadByBarber = useCallback(async () => {
    if (viewMode !== "barber") return;
    try {
      const params = { date: TODAY };
      const response = await api.get("/appointments/by-barber", { params });
      setByBarberData(response.data || response);
    } catch (error) {
      console.error("Load by barber error:", error);
    }
  }, [viewMode]);

  const loadLists = useCallback(async () => {
    try {
      const [customersRes, employeesRes, servicesRes, catsRes] =
        await Promise.all([
          api.get("/customers", { params: { limit: 1000 } }),
          api.get("/employees", { params: { limit: 1000 } }),
          api.get("/services", { params: { limit: 1000 } }),
          api.get("/service-categories"),
        ]);
      setCustomers(adaptList(customersRes));
      setEmployees(adaptList(employeesRes));
      setServices(adaptList(servicesRes));
      setCategories(adaptList(catsRes));
    } catch (error) {
      console.error("Load booking lists error:", error);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    loadUpcoming();
    loadLists();
    const interval = setInterval(() => {
      loadBookings();
      loadUpcoming();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadBookings, loadUpcoming, loadLists]);

  useEffect(() => {
    const handleMessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          msg.event?.startsWith("appointment_") ||
          msg.event === "invoice_created"
        ) {
          loadBookings();
          loadUpcoming();
        }
      } catch (err) {
        console.error("WS Parse Error in Bookings", err);
      }
    };

    socket?.addEventListener("message", handleMessage);
    return () => socket?.removeEventListener("message", handleMessage);
  }, [socket, loadBookings, loadUpcoming]);

  useEffect(() => {
    if (viewMode === "barber") {
      loadByBarber();
    }
  }, [viewMode, loadByBarber]);

  const filteredBookings = useMemo(() => {
    return safeBookings.filter((booking) => {
      const name = booking.customerName || booking.customer_name || "";
      const phone = booking.customerPhone || booking.customer_phone || "";
      const status = normalizeStatus(booking.status);
      const matchesSearch =
        !searchTerm ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        phone.includes(searchTerm);

      const matchesFilter =
        activeTab === "الكل" ||
        (activeTab === "قادم" && ["WAITING", "CONFIRMED"].includes(status)) ||
        (activeTab === "قيد التنفيذ" && status === "IN_PROGRESS") ||
        (activeTab === "جاهز للدفع" && status === "READY_FOR_PAYMENT") ||
        (activeTab === "مكتمل" &&
          (status === "DONE" || status === "INVOICED")) ||
        (activeTab === "ملغي" && status === "CANCELLED");

      return matchesSearch && matchesFilter;
    });
  }, [safeBookings, activeTab, searchTerm]);

  const bookingStats = useMemo(() => {
    const waiting = safeBookings.filter((b) =>
      ["WAITING", "CONFIRMED"].includes(normalizeStatus(b.status)),
    ).length;
    const inProgress = safeBookings.filter(
      (b) => normalizeStatus(b.status) === "IN_PROGRESS",
    ).length;
    const ready = safeBookings.filter(
      (b) => normalizeStatus(b.status) === "READY_FOR_PAYMENT",
    ).length;
    const done = safeBookings.filter((b) =>
      ["DONE", "INVOICED"].includes(normalizeStatus(b.status)),
    ).length;
    return { total: safeBookings.length, waiting, inProgress, ready, done };
  }, [safeBookings]);

  const groupedServices = useMemo(() => {
    const groups = { all: [] };
    categories.forEach((cat) => {
      groups[cat.id] = [];
    });
    safeServices.forEach((s) => {
      groups.all.push(s);
      const catId = s.category_id || s.categoryId;
      if (catId && groups[catId]) {
        groups[catId].push(s);
      }
    });
    return groups;
  }, [services, categories]);

  function resetForm() {
    setEditingBooking(null);
    setServiceToAdd("");
    setCustomerMode("existing");
    setNewCustomer({ firstName: "", phone: "", phone2: "" });
    setFormData(emptyForm);
    setSelectedServiceCategory("all");
  }

  function openCreateBooking() {
    resetForm();
    setIsModalOpen(true);
  }

  function openEditBooking(booking) {
    setEditingBooking(booking);
    setCustomerMode("existing");
    setFormData({
      customerId: String(booking.customerId || booking.customer_id || ""),
      employeeId: String(
        booking.barberId ||
          booking.barber_id ||
          booking.employeeId ||
          booking.employee_id ||
          "",
      ),
      appointmentDate: String(
        booking.appointmentDate || booking.appointment_date || TODAY,
      ).slice(0, 10),
      appointmentTime: String(
        booking.appointmentTime ||
          booking.appointment_time ||
          booking.startTime ||
          booking.start_time ||
          "",
      ).slice(0, 5),
      notes: booking.notes || "",
      services: Array.isArray(booking.services)
        ? booking.services.map((s) => ({
            serviceId: Number(s.serviceId || s.service_id || s.id),
            quantity: Number(s.quantity || 1),
          }))
        : [],
    });
    setIsModalOpen(true);
  }

  async function handleStatus(booking, status) {
    try {
      setActionLoading(`${booking.id}-${status}`);
      await api.patch(`/appointments/${booking.id}/status`, { status });
      toast.success("تم تحديث الحالة بنجاح");
      await loadBookings();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "فشل تحديث الحالة");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveBooking() {
    if (
      !formData.appointmentDate ||
      !formData.appointmentTime ||
      formData.services.length === 0
    ) {
      toast.error("يرجى إكمال البيانات المطلوبة");
      return;
    }

    let customerId = formData.customerId;
    if (customerMode === "new") {
      try {
        setSaving(true);
        const res = await api.post("/customers", {
          first_name: newCustomer.firstName,
          phone: newCustomer.phone,
          alternate_phone: newCustomer.phone2,
        });
        const created = adaptItem(res);
        customerId = getId(created);
        await loadLists();
      } catch (error) {
        toast.error("فشل إضافة العميل الجديد");
        setSaving(false);
        return;
      }
    }

    if (!customerId) {
      toast.error("يرجى اختيار العميل");
      setSaving(false);
      return;
    }

    const payload = {
      customerId: Number(customerId),
      employeeId: formData.employeeId ? Number(formData.employeeId) : null,
      appointmentDate: formData.appointmentDate,
      appointmentTime: formData.appointmentTime,
      notes: formData.notes,
      services: formData.services,
    };

    try {
      setSaving(true);
      if (editingBooking) {
        await api.patch(`/appointments/${editingBooking.id}`, payload);
        toast.success("تم تحديث الحجز");
      } else {
        await api.post("/appointments", payload);
        toast.success("تم إنشاء الحجز");
      }
      setIsModalOpen(false);
      loadBookings();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "فشل حفظ الحجز");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickAssign(bookingId, employeeId) {
    try {
      setActionLoading(`${bookingId}-assign`);
      await api.patch(`/appointments/${bookingId}/assign-barber`, {
        employee_id: Number(employeeId),
      });
      toast.success("تم تعيين الخبير بنجاح");
      await loadBookings();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "فشل تعيين الخبير");
    } finally {
      setActionLoading(null);
    }
  }

  const renderBookingCard = (booking) => {
    const config = statusConfig(booking.status);
    const status = normalizeStatus(booking.status);
    const customerName =
      booking.customerName || booking.customer_name || "عميل";
    const phone = booking.customerPhone || booking.customer_phone || "";
    const barberName =
      booking.barberName ||
      booking.barber_name ||
      booking.employeeName ||
      booking.employee_name;
    const time = String(
      booking.appointmentTime || booking.appointment_time || "",
    ).slice(0, 5);
    const servicesText = Array.isArray(booking.services)
      ? booking.services
          .map((s) => s.serviceName || s.name || s.display_name)
          .join("، ")
      : "خدمات";

    const canEdit =
      status !== "INVOICED" &&
      status !== "ARCHIVED" &&
      (role !== "CASHIER" || status === "WAITING" || status === "CONFIRMED");
    const noBarber = !barberName;

    return (
      <Card
        key={booking.id}
        className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow duration-300 rounded-3xl"
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Badge
              variant={config.variant}
              className="rounded-full px-4 py-1 text-xs font-black"
            >
              {config.label}
            </Badge>
            <div className="flex items-center gap-2 text-gray-400 font-bold text-xs">
              <Clock size={14} /> {time}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white truncate">
              {customerName}
            </h3>
            {phone && (
              <div
                className="flex items-center gap-2 mt-1 text-gray-500 font-medium text-sm"
                dir="ltr"
              >
                <Phone size={12} /> {phone}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-2xl relative group/barber">
              <span className="text-[10px] text-gray-400 font-black block mb-1">
                الخبير
              </span>
              {canEdit ? (
                <Select
                  value={String(booking.barberId || booking.barber_id || "")}
                  onValueChange={(val) => handleQuickAssign(booking.id, val)}
                  disabled={actionLoading === `${booking.id}-assign`}
                >
                  <SelectTrigger className="h-auto p-0 border-none bg-transparent shadow-none focus:ring-0 text-xs font-black text-main hover:text-accent transition-colors text-right">
                    <SelectValue placeholder="تعيين خبير" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border bg-overlay backdrop-blur-xl">
                    {safeEmployees.map((emp) => (
                      <SelectItem
                        key={emp.id}
                        value={String(emp.id)}
                        className="rounded-xl text-xs font-bold focus:bg-accent focus:text-white"
                      >
                        {getEmployeeName(emp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs font-black text-gray-700 dark:text-gray-300 truncate block">
                  {barberName || "غير محدد"}
                </span>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-2xl">
              <span className="text-[10px] text-gray-400 font-black block mb-1">
                الخدمات
              </span>
              <span className="text-xs font-black text-primary truncate block">
                {servicesText}
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {["WAITING", "CONFIRMED"].includes(status) && (
              <>
                <Button
                  className="flex-1 rounded-2xl h-10 font-black text-xs"
                  onClick={() => handleStatus(booking, "IN_PROGRESS")}
                  loading={actionLoading === `${booking.id}-in_progress`}
                >
                  بدء الجلسة
                </Button>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl h-10 w-10"
                    onClick={() => openEditBooking(booking)}
                  >
                    <Edit3 size={16} />
                  </Button>
                )}
                <Button
                  variant="dangerSoft"
                  size="icon"
                  className="rounded-xl h-10 w-10"
                  onClick={() => handleStatus(booking, "CANCELLED")}
                >
                  <X size={16} />
                </Button>
              </>
            )}

            {status === "IN_PROGRESS" && (
              <div className="flex w-full gap-2">
                <Button
                  className="flex-1 rounded-2xl h-10 font-black text-xs"
                  variant="success"
                  onClick={() => handleStatus(booking, "READY_FOR_PAYMENT")}
                  loading={actionLoading === `${booking.id}-ready_for_payment`}
                >
                  إتمام وإرسال للكاشير
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl h-10 w-10"
                  onClick={() => handleStatus(booking, "DONE")}
                >
                  <CheckCircle2 size={16} />
                </Button>
              </div>
            )}

            {(status === "DONE" || status === "READY_FOR_PAYMENT") && (
              <div className="flex w-full gap-2">
                {status === "DONE" ? (
                  <Button
                    className="flex-1 rounded-2xl h-10 font-black text-xs"
                    variant="success"
                    onClick={() => handleStatus(booking, "READY_FOR_PAYMENT")}
                  >
                    إرسال للكاشير
                  </Button>
                ) : (
                  <div className="flex-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center text-[10px] font-black">
                    بانتظار الدفع عند الكاشير
                  </div>
                )}
                {canEdit && (
                  <Button
                    variant="outline"
                    className="rounded-2xl h-10 font-black text-xs"
                    onClick={() => openEditBooking(booking)}
                  >
                    تعديل
                  </Button>
                )}
              </div>
            )}

            {status === "INVOICED" && (
              <div className="w-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl p-2 text-center text-[10px] font-black">
                تمت الفوترة - لا يمكن التعديل المباشر
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading && safeBookings.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-gray-500 font-bold">جاري تحميل الحجوزات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page-container space-y-6 pb-6 sm:space-y-8" dir="rtl">
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            إدارة الحجوزات
          </h1>
          <p className="page-subtitle mt-2">
            نظام احترافي لإدارة مواعيد وخدمات الصالون
          </p>
        </div>

        <div className="surface-toolbar flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 rounded-[1.35rem] bg-slate-50/80 p-1.5 dark:bg-white/5">
            <button
              onClick={() => setViewMode("list")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all sm:flex-none sm:px-6 ${viewMode === "list" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"}`}
            >
              <ListIcon size={16} /> قائمة
            </button>
            <button
              onClick={() => setViewMode("barber")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all sm:flex-none sm:px-6 ${viewMode === "barber" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"}`}
            >
              <LayoutGrid size={16} /> الموظفين
            </button>
          </div>
          <Button
            onClick={openCreateBooking}
            className="h-11 w-full gap-2 rounded-2xl px-6 text-xs font-black lg:w-auto"
          >
            <Plus size={18} /> حجز جديد
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "بانتظار التأكيد",
            value: bookingStats.waiting,
            color: "text-amber-500",
            bg: "bg-amber-50 dark:bg-amber-500/10",
          },
          {
            label: "قيد التنفيذ",
            value: bookingStats.inProgress,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-500/10",
          },
          {
            label: "جاهز للدفع",
            value: bookingStats.ready,
            color: "text-emerald-500",
            bg: "bg-emerald-50 dark:bg-emerald-500/10",
          },
          {
            label: "إجمالي اليوم",
            value: bookingStats.total,
            color: "text-primary",
            bg: "bg-primary/5",
          },
        ].map((stat, i) => (
          <Card
            key={i}
            className={`border-none shadow-sm rounded-3xl ${stat.bg}`}
          >
            <CardContent className="p-4 sm:p-6">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                {stat.label}
              </span>
              <div
                className={`mt-1 text-2xl font-black sm:text-3xl ${stat.color}`}
              >
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Bar */}
      <Card className="rounded-3xl border-none shadow-sm overflow-visible">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="chip-scroller">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${dateFilter === f.id ? "bg-primary text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] animate-in fade-in slide-in-from-right-2">
              <Input
                type="date"
                value={startDate || ""}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 rounded-xl text-xs font-bold"
              />
              <span className="self-center text-center font-bold text-gray-400">
                إلى
              </span>
              <Input
                type="date"
                value={endDate || ""}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 rounded-xl text-xs font-bold"
              />
            </div>
          )}

          <div className="relative w-full">
            <Search
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <Input
              placeholder="ابحث باسم العميل أو رقم الهاتف..."
              className="pr-11 h-11 rounded-2xl bg-gray-50 border-none text-sm font-medium"
              value={searchTerm || ""}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Tabs
          value={activeTab || ""}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto min-w-max gap-2 bg-transparent p-0">
              {[
                "الكل",
                "قادم",
                "قيد التنفيذ",
                "جاهز للدفع",
                "مكتمل",
                "ملغي",
              ].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab || ""}
                  className="whitespace-nowrap rounded-2xl border border-transparent px-5 py-2.5 text-xs font-black data-[state=active]:border-black/5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {viewMode === "list" ? (
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
            {/* Main List */}
            <div className="space-y-6">
              {filteredBookings.length === 0 ? (
                <div className="bg-white dark:bg-white/5 rounded-3xl p-16 text-center border-2 border-dashed border-gray-100 dark:border-white/5">
                  <Calendar className="mx-auto h-16 w-16 text-gray-200 mb-4" />
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">
                    لا توجد حجوزات
                  </h3>
                  <p className="text-gray-500 font-bold mt-2">
                    لم نجد أي حجوزات تطابق خيارات البحث الحالية
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {filteredBookings.map((booking) =>
                    renderBookingCard(booking),
                  )}
                </div>
              )}
            </div>

            {/* Sidebar Upcoming */}
            <div className="space-y-6">
              <Card className="overflow-hidden rounded-3xl border-none shadow-sm 2xl:sticky 2xl:top-24">
                <CardContent className="p-0">
                  <div className="p-6 border-b border-black/5 flex items-center justify-between">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <Clock className="text-primary" size={20} /> حجوزات قادمة
                    </h2>
                    <Badge variant="accent" className="rounded-full">
                      {safeUpcomingBookings.length}
                    </Badge>
                  </div>
                  <div className="p-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {safeUpcomingBookings.length === 0 ? (
                      <div className="p-12 text-center text-gray-400 font-bold text-sm">
                        لا توجد حجوزات مسبقة
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {safeUpcomingBookings.map((b) => (
                          <div
                            key={b.id}
                            className="p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-black text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                                {getCustomerName(b)}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0"
                              >
                                {statusConfig(b.status).label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-500 font-bold">
                              <span>
                                {String(b.appointmentDate || "").slice(0, 10)}
                              </span>
                              <span>•</span>
                              <span>
                                {String(b.appointmentTime || "").slice(0, 5)}
                              </span>
                            </div>
                            <div className="text-[10px] text-primary font-black mt-1">
                              {b.barberName || b.barber_name || "غير معين"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-white/5 text-center">
                    <Button
                      variant="ghost"
                      className="text-xs font-black text-gray-500 w-full rounded-xl"
                    >
                      عرض التقويم الكامل{" "}
                      <ChevronRight size={14} className="mr-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Barber Grid View */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {byBarberData.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <Activity className="mx-auto h-12 w-12 text-gray-200 mb-4" />
                <p className="text-gray-500 font-bold">
                  لا توجد بيانات للموظفين حالياً
                </p>
              </div>
            ) : (
              byBarberData.map((item) => {
                const barber = item.barber || {};
                const list = Array.isArray(item.appointments)
                  ? item.appointments
                  : [];
                const stats = item.stats || { total: list.length };

                return (
                  <Card
                    key={getId(barber)}
                    className="rounded-3xl border-none shadow-sm overflow-hidden flex flex-col h-[500px]"
                  >
                    <div className="p-5 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
                      <EmployeeAvatar
                        imageUrl={
                          barber.profileImageUrl || barber.profile_image_url
                        }
                        name={getEmployeeName(barber)}
                        size="md"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white truncate">
                          {getEmployeeName(barber)}
                        </h4>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] font-black text-blue-500">
                            {stats.in_progress || 0} نشط
                          </span>
                          <span className="text-[10px] font-black text-emerald-500">
                            {stats.ready_for_payment || 0} جاهز
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {list.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-300 font-bold text-xs italic">
                          لا توجد حجوزات
                        </div>
                      ) : (
                        list.map((b) => (
                          <div
                            key={b.id}
                            className="p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-black/5"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[100px]">
                                {getCustomerName(b)}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500">
                                {String(b.appointmentTime || "").slice(0, 5)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={statusConfig(b.status).variant}
                                className="text-[9px] px-1.5 py-0 h-4"
                              >
                                {statusConfig(b.status).label}
                              </Badge>
                              <div className="flex gap-1">
                                <button
                                  className="p-1 hover:text-primary transition-colors"
                                  onClick={() => openEditBooking(b)}
                                >
                                  <Edit3 size={12} />
                                </button>
                                {normalizeStatus(b.status) === "WAITING" && (
                                  <button
                                    className="p-1 hover:text-emerald-500 transition-colors"
                                    onClick={() =>
                                      handleStatus(b, "IN_PROGRESS")
                                    }
                                  >
                                    <CheckCircle2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-5xl rounded-[2rem] border-none p-0 sm:rounded-[2.5rem]"
          dir="rtl"
        >
          <div className="relative bg-primary px-5 py-6 text-white sm:px-8 sm:py-8">
            <DialogTitle className="text-xl font-black sm:text-2xl">
              {editingBooking ? "تعديل حجز" : "حجز موعد جديد"}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 font-bold mt-1">
              أدخل بيانات العميل والموعد والخدمات المطلوبة بدقة.
            </DialogDescription>
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute left-6 top-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="custom-scrollbar grid max-h-[calc(92dvh-12rem)] grid-cols-1 gap-6 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6 lg:grid-cols-2 lg:gap-8">
            {/* Customer Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <UserIcon size={18} />
                </div>
                <h3 className="font-black text-gray-900 dark:text-white">
                  بيانات العميل
                </h3>
              </div>

              {!editingBooking && (
                <div className="flex p-1 bg-gray-50 dark:bg-white/5 rounded-2xl">
                  <button
                    onClick={() => setCustomerMode("existing")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${customerMode === "existing" ? "bg-white dark:bg-white/10 shadow-sm text-primary" : "text-gray-500"}`}
                  >
                    عميل مسجل
                  </button>
                  <button
                    onClick={() => setCustomerMode("new")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${customerMode === "new" ? "bg-white dark:bg-white/10 shadow-sm text-primary" : "text-gray-500"}`}
                  >
                    إضافة جديد
                  </button>
                </div>
              )}

              {customerMode === "existing" ? (
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 mr-2">
                    ابحث عن العميل
                  </label>
                  <Select
                    value={formData.customerId || ""}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, customerId: v }))
                    }
                  >
                    <SelectTrigger className="rounded-2xl h-12 bg-gray-50 border-none font-bold">
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeCustomers.map((c) => (
                        <SelectItem
                          key={getId(c)}
                          value={String(getId(c)) || ""}
                        >
                          {getCustomerName(c)} - {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 mr-2">
                      اسم العميل
                    </label>
                    <Input
                      placeholder="الاسم بالكامل"
                      className="rounded-2xl h-12 bg-gray-50 border-none font-bold"
                      value={newCustomer.firstName || ""}
                      onChange={(e) =>
                        setNewCustomer((p) => ({
                          ...p,
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 mr-2">
                      رقم الهاتف
                    </label>
                    <Input
                      placeholder="01xxxxxxxxx"
                      dir="ltr"
                      className="rounded-2xl h-12 bg-gray-50 border-none font-bold"
                      value={newCustomer.phone || ""}
                      onChange={(e) =>
                        setNewCustomer((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Calendar size={18} />
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white">
                    الموعد والخبير
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 mr-1">
                      التاريخ
                    </label>
                    <Input
                      type="date"
                      className="rounded-xl h-11 bg-gray-50 border-none font-bold"
                      value={formData.appointmentDate || ""}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          appointmentDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 mr-1">
                      الوقت
                    </label>
                    <Input
                      type="time"
                      className="rounded-xl h-11 bg-gray-50 border-none font-bold"
                      value={formData.appointmentTime || ""}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          appointmentTime: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-[10px] font-black text-gray-400 mr-1">
                    الخبير المسؤول
                  </label>
                  <Select
                    value={formData.employeeId || ""}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, employeeId: v }))
                    }
                  >
                    <SelectTrigger className="rounded-xl h-11 bg-gray-50 border-none font-bold">
                      <SelectValue placeholder="اختر الخبير (اختياري)" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeEmployees.map((e) => (
                        <SelectItem
                          key={getId(e)}
                          value={String(getId(e)) || ""}
                        >
                          {getEmployeeName(e)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Services Selection */}
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Activity size={18} />
                  </div>
                  <h3 className="font-black text-gray-900 dark:text-white">
                    الخدمات المطلوبة
                  </h3>
                </div>
                {formData.services.length > 0 && (
                  <Badge variant="success" className="rounded-full font-black">
                    {formData.services.length} خدمات
                  </Badge>
                )}
              </div>

              <div className="space-y-4">
                <Tabs
                  value={selectedServiceCategory || ""}
                  onValueChange={setSelectedServiceCategory}
                >
                  <div className="overflow-x-auto pb-2 custom-scrollbar">
                    <TabsList className="bg-gray-100 dark:bg-white/5 h-auto p-1 gap-1 rounded-2xl">
                      <TabsTrigger
                        value="all"
                        className="rounded-xl px-4 py-2 text-[10px] font-black data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm"
                      >
                        الكل
                      </TabsTrigger>
                      {categories.map((cat) => (
                        <TabsTrigger
                          key={cat.id}
                          value={String(cat.id) || ""}
                          className="rounded-xl px-4 py-2 text-[10px] font-black data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm whitespace-nowrap"
                        >
                          {cat.name_ar || cat.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  <div className="custom-scrollbar mt-4 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto p-1 sm:grid-cols-2">
                    {(groupedServices[selectedServiceCategory] || []).map(
                      (s) => {
                        const isSelected = formData.services.some(
                          (item) => Number(item.serviceId) === Number(getId(s)),
                        );
                        return (
                          <button
                            key={getId(s)}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFormData((p) => ({
                                  ...p,
                                  services: p.services.filter(
                                    (item) =>
                                      Number(item.serviceId) !==
                                      Number(getId(s)),
                                  ),
                                }));
                              } else {
                                setFormData((p) => ({
                                  ...p,
                                  services: [
                                    ...p.services,
                                    {
                                      serviceId: Number(getId(s)),
                                      quantity: 1,
                                    },
                                  ],
                                }));
                              }
                            }}
                            className={`flex flex-col items-start p-3 rounded-2xl border-2 transition-all text-right ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-gray-100 dark:border-white/5 bg-white dark:bg-white/5 hover:border-primary/50"}`}
                          >
                            <span className="text-[11px] font-black text-gray-900 dark:text-white line-clamp-1">
                              {getServiceName(s)}
                            </span>
                            <span className="text-[10px] font-bold text-primary mt-1">
                              {s.price || s.sell_price || 0} ج.م
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </Tabs>

                <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-[2rem] space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-black text-gray-500">
                      ملخص الخدمات
                    </span>
                    <ShoppingCart size={14} className="text-gray-400" />
                  </div>

                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {formData.services.length === 0 ? (
                      <div className="py-6 text-center text-gray-400 text-[10px] font-bold italic">
                        لا توجد خدمات مضافة
                      </div>
                    ) : (
                      formData.services.map((item, idx) => {
                        const service = safeServices.find(
                          (s) => Number(getId(s)) === Number(item.serviceId),
                        );
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white dark:bg-white/10 rounded-2xl shadow-sm animate-in slide-in-from-left-2"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-gray-700 dark:text-gray-200">
                                {getServiceName(service)}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">
                                {service?.price || 0} ج.م
                              </span>
                            </div>
                            <button
                              type="button"
                              className="p-1.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                              onClick={() =>
                                setFormData((p) => ({
                                  ...p,
                                  services: p.services.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }))
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {formData.services.length > 0 && (
                    <div className="pt-3 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center px-2">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        إجمالي تقديري
                      </span>
                      <span className="text-lg font-black text-primary">
                        {formData.services.reduce((acc, curr) => {
                          const s = safeServices.find(
                            (srv) =>
                              Number(getId(srv)) === Number(curr.serviceId),
                          );
                          return acc + Number(s?.price || s?.sell_price || 0);
                        }, 0)}{" "}
                        ج.م
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 mr-1">
                  ملاحظات إضافية
                </label>
                <Input
                  placeholder="أي ملاحظات خاصة بهذا الحجز..."
                  className="rounded-2xl h-12 bg-gray-50 border-none text-sm font-medium"
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse items-stretch gap-3 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6 dark:bg-white/5">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="h-12 rounded-2xl px-8 font-black"
            >
              إلغاء
            </Button>
            <Button
              className="h-12 rounded-2xl px-8 font-black shadow-lg shadow-primary/20 sm:px-12"
              onClick={handleSaveBooking}
              disabled={saving}
              loading={saving}
            >
              <Save size={18} className="ml-2" /> حفظ بيانات الحجز
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
