import { Calendar, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PremiumUI";
import InlineNotice from "@/components/shared/InlineNotice";
import { PageShell } from "@/components/shared/PageShell";
import i18n from "@/i18n";
import { useBarberBookings } from "@/features/barber-bookings/hooks/useBarberBookings";
import { QuickStats } from "@/features/barber-bookings";
import { BookingsFilters } from "@/features/barber-bookings";
import { AppointmentsList } from "@/features/barber-bookings";
import { CalendarView } from "@/features/barber-bookings";

const BarberBookings = () => {
  const {
    activeTab,
    setActiveTab,
    selectedDate,
    setSelectedDate,
    appointments,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    calendarMonth,
    setCalendarMonth,
    fetchAppointments,
    handleStatusChange,
    filteredAppointments,
    groupedByDate,
    getCalendarDays,
    statusLabels,
    statusColors,
    loadError,
  } = useBarberBookings();

  return (
    <div dir={i18n.dir() as "rtl" | "ltr"}>
      <PageShell contained>
        {loadError && !loading && (
          <InlineNotice tone="error">{loadError}</InlineNotice>
        )}
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
                <RefreshCw size={14} className="ms-1.5" />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
            </div>
          }
        />

        <QuickStats appointments={appointments} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-card border border-border p-1 max-w-md">
            <TabsTrigger
              value="list"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <FileText size={14} className="ms-1.5" /> قائمة المواعيد
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-xl font-black text-xs data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <Calendar size={14} className="ms-1.5" /> التقويم
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <BookingsFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
            />
            <AppointmentsList
              loading={loading}
              filteredAppointments={filteredAppointments}
              groupedByDate={groupedByDate}
              handleStatusChange={handleStatusChange}
              statusLabels={statusLabels}
              statusColors={statusColors}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <CalendarView
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              getCalendarDays={getCalendarDays}
              appointments={appointments}
              statusLabels={statusLabels}
              statusColors={statusColors}
              />
            </TabsContent>
          </Tabs>
      </PageShell>
    </div>
  );
};
export default BarberBookings;
