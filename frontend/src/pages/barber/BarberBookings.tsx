import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import { barberService } from "@/services/barberService";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  User,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Scissors,
  CheckCircle,
  Play,
  Filter,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatePresence } from "framer-motion";

const BarberBookings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("list");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
   
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
       
      const monthStr: any = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
      const res = await barberService.getCalendar(monthStr);
      setAppointments(res?.appointments || []);
    } catch (err) {
      console.error("Appointments fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [calendarMonth]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusChange = async (id: string | number, newStatus: string) => {
    try {
      await barberService.updateStatus(id, newStatus);
      fetchAppointments();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    waiting: "في الانتظار",
    "in-service": "قيد الخدمة",
    completed: "مكتمل",
    ready_for_payment: "جاهز للدفع",
    cancelled: "ملغي",
  };

  const statusColors: Record<string, "warning" | "info" | "success" | "danger" | "secondary"> = {
    pending: "warning",
    waiting: "warning",
    "in-service": "info",
    completed: "success",
    ready_for_payment: "success",
    cancelled: "danger",
  };

  // Filter appointments
   
  const filteredAppointments = appointments.filter((apt: any) => {
    const matchesSearch =
      (apt.customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (apt.service_name || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
    const matchesDate = !selectedDate || apt.appointment_date === selectedDate;
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Group by date
   
  const groupedByDate: Record<string, any[]> = filteredAppointments.reduce((acc: Record<string, any[]>, apt: any) => {
    const date = apt.appointment_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(apt);
    return acc;
  }, {});

  // Calendar helpers
  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
     
    const days: any[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayAppointments = appointments.filter(
        (a) => a.appointment_date === dateStr,
      );
      days.push({
        day: i,
        date: dateStr,
        isToday: dateStr === new Date().toISOString().split("T")[0],
        count: dayAppointments.length,
        hasCompleted: dayAppointments.some(
          (a) => a.status === "completed" || a.status === "ready_for_payment",
        ),
        hasPending: dayAppointments.some(
          (a) => a.status === "waiting" || a.status === "in-service",
        ),
      });
    }
    return days;
  };

  return (
    <div className="min-h-screen pb-12" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader
          title="حجوزاتي"
          subtitle="إدارة مواعيدك ومتابعة حجوزاتك"
          badge="الحجوزات"
          icon={Calendar}
          className={undefined}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl px-3"
                onClick={fetchAppointments}
              >
                <RefreshCw size={14} className="ml-1.5" />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
            </div>
          }
        />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PremiumCard className="p-3" delay={0}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Calendar size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  الكلي
                </p>
                <p className="text-lg font-black text-main">
                  {appointments.length}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3" delay={0.1}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                <Clock size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  قيد الانتظار
                </p>
                <p className="text-lg font-black text-main">
                  {appointments.filter((a) => a.status === "waiting").length}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3" delay={0.2}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
                <Scissors size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  قيد الخدمة
                </p>
                <p className="text-lg font-black text-main">
                  {appointments.filter((a) => a.status === "in-service").length}
                </p>
              </div>
            </div>
          </PremiumCard>
          <PremiumCard className="p-3" delay={0.3}>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
                <CheckCircle size={14} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase text-muted">
                  مكتمل
                </p>
                <p className="text-lg font-black text-main">
                  {
                    appointments.filter(
                      (a) =>
                        a.status === "completed" ||
                        a.status === "ready_for_payment",
                    ).length
                  }
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-card border border-border p-1 max-w-md">
            <TabsTrigger
              value="list"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <FileText size={14} className="ml-1.5" /> قائمة المواعيد
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Calendar size={14} className="ml-1.5" /> التقويم
            </TabsTrigger>
          </TabsList>

          {/* List View */}
          <TabsContent value="list" className="space-y-4">
            {/* Filters */}
            <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted/60"
                  />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="بحث بالعميل أو الخدمة..."
                    className="h-10 w-full pr-9 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-soft px-3 text-xs font-bold"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-soft px-2 text-xs font-bold"
                  >
                    <option value="all">كل الحالات</option>
                    <option value="waiting">في الانتظار</option>
                    <option value="in-service">قيد الخدمة</option>
                    <option value="completed">مكتمل</option>
                    <option value="ready_for_payment">جاهز للدفع</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                  {(selectedDate || statusFilter !== "all" || searchTerm) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                        setSelectedDate("");
                        setStatusFilter("all");
                        setSearchTerm("");
                      }}
                    >
                      <Filter size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Appointments List */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl bg-card border border-border animate-pulse"
                  />
                ))}
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
                <Calendar size={40} className="mb-3 text-muted" />
                <p className="text-base font-black text-main">لا توجد مواعيد</p>
                <p className="mt-1 text-xs font-bold text-muted">
                  لا توجد مواعيد مطابقة للفلاتر المحددة
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(groupedByDate)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, dayApps]) => (
                    <div key={date} className="space-y-2">
                      <p className="text-xs font-black text-muted px-1">
                        {new Date(date).toLocaleDateString("ar-EG", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <AnimatePresence>
                        {dayApps.map((apt, i) => (
                          <motion.div
                            key={apt.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="rounded-xl border border-border bg-card p-4 shadow-soft hover:shadow-premium transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center",
                                    apt.status === "waiting"
                                      ? "bg-warning/10 text-warning"
                                      : apt.status === "in-service"
                                        ? "bg-info/10 text-info"
                                        : apt.status === "completed" ||
                                            apt.status === "ready_for_payment"
                                          ? "bg-success/10 text-success"
                                          : "bg-soft text-muted",
                                  )}
                                >
                                  {apt.status === "waiting" ? (
                                    <Clock size={18} />
                                  ) : apt.status === "in-service" ? (
                                    <Scissors size={18} />
                                  ) : (
                                    <CheckCircle size={18} />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-main">
                                    {apt.customer_name || "عميل"}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge
                                      variant="outline"
                                      className="h-5 px-2 text-[8px] font-black"
                                    >
                                      {apt.service_name || "خدمة"}
                                    </Badge>
                                    <span className="text-[10px] font-bold text-muted">
                                      {apt.start_time || "--:--"}
                                    </span>
                                    {apt.total_amount > 0 && (
                                      <span className="text-[10px] font-bold text-primary">
                                        {apt.total_amount} ج.م
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    statusColors[apt.status] || "secondary"
                                  }
                                  className="h-6 px-3 text-[9px] font-black"
                                >
                                  {statusLabels[apt.status] || apt.status}
                                </Badge>
                                {apt.status === "waiting" && (
                                  <Button
                                    size="sm"
                                    className="h-8 rounded-lg px-3 text-[10px] font-black"
                                    onClick={() =>
                                      handleStatusChange(apt.id, "in-service")
                                    }
                                  >
                                    <Play size={10} className="ml-1" /> بدء
                                  </Button>
                                )}
                                {apt.status === "in-service" && (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    className="h-8 rounded-lg px-3 text-[10px] font-black"
                                    onClick={() =>
                                      handleStatusChange(apt.id, "completed")
                                    }
                                  >
                                    <CheckCircle size={10} className="ml-1" />{" "}
                                    إنهاء
                                  </Button>
                                )}
                              </div>
                            </div>
                            {apt.notes && (
                              <p className="mt-2 text-[10px] font-bold text-muted mr-13">
                                📝 {apt.notes}
                              </p>
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* Calendar View */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                      ),
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="text-sm font-black text-main">
                  {calendarMonth.toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                  })}
                </span>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                      ),
                    )
                  }
                  className="h-9 w-9 rounded-lg border border-border hover:bg-soft flex items-center justify-center"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {[
                  "أحد",
                  "إثنين",
                  "ثلاثاء",
                  "أربعاء",
                  "خميس",
                  "جمعة",
                  "سبت",
                ].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-black text-muted py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map((day, i) => (
                  <button
                    key={i}
                    onClick={() => day && setSelectedDate(day.date)}
                    className={cn(
                      "min-h-[50px] rounded-lg border p-1 text-center transition-all",
                      day
                        ? day.isToday
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-soft"
                        : "border-transparent",
                      selectedDate === day?.date && "ring-2 ring-primary",
                    )}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            "text-[10px] font-black",
                            day.isToday ? "text-primary" : "text-main",
                          )}
                        >
                          {day.day}
                        </span>
                        {day.count > 0 && (
                          <div className="mt-1 flex justify-center gap-0.5 flex-wrap">
                            {day.hasPending && (
                              <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                            )}
                            {day.hasCompleted && (
                              <div className="w-1.5 h-1.5 rounded-full bg-success" />
                            )}
                            <span className="text-[8px] font-bold text-muted">
                              {day.count}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Date Appointments */}
            {selectedDate && (
              <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-black text-main">
                    مواعيد{" "}
                    {new Date(selectedDate).toLocaleDateString("ar-EG", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {appointments.filter(
                    (a) => a.appointment_date === selectedDate,
                  ).length > 0 ? (
                    appointments
                      .filter((a) => a.appointment_date === selectedDate)
                      .map((apt) => (
                        <div key={apt.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-soft flex items-center justify-center">
                                <User size={14} className="text-muted" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-main">
                                  {apt.customer_name}
                                </p>
                                <p className="text-[10px] font-bold text-muted">
                                  {apt.service_name} • {apt.start_time}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={statusColors[apt.status] || "secondary"}
                              className="h-6 px-3 text-[9px] font-black"
                            >
                              {statusLabels[apt.status] || apt.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="p-8 text-center">
                      <Calendar size={32} className="mx-auto mb-2 text-muted" />
                      <p className="text-xs font-bold text-muted">
                        لا توجد مواعيد في هذا اليوم
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarberBookings;
