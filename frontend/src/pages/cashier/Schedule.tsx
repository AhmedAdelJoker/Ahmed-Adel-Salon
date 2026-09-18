import {
  DndContext,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { cn } from "@/lib/core/utils";

import Toolbar from "@/pages/cashier/schedule/Toolbar";
import ScheduleStatsBar from "@/pages/cashier/schedule/ScheduleStatsBar";
import DayBoard from "@/pages/cashier/schedule/DayBoard";
import WeekBoard from "@/pages/cashier/schedule/WeekBoard";
import ListView from "@/pages/cashier/schedule/ListView";
import ScheduleModal from "@/pages/cashier/schedule/ScheduleModal";
import AgendaPanel from "@/pages/cashier/schedule/AgendaPanel";
import { ContentPanel, PageHeader } from "@/components/shared/PremiumUI";
import { AnimatePresence } from "framer-motion";
import { CalendarDays } from "lucide-react";

import {
  useSchedule,
  ScheduleHeaderActions,
  ScheduleLoadingSkeleton,
  ScheduleDragPreview,
} from "@/features/schedule";

function SchedulePage() {
  const navigate = useNavigate();
  const {
    selectedDate,
    setSelectedDate,
    appointments,
    barbers,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    barberFilter,
    setBarberFilter,
    range,
    setRange,
    sidebarOpen,
    setSidebarOpen,
    draggingId,
    selectedAppointment,
    setSelectedAppointment,
    lastUpdated,
    rangeConfig,
    filteredAppointments,
    barbersWithAppointments,
    stats,
    draggedAppointment,
    hasActiveFilters,
    loadData,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    sensors,
    handleExport,
    handleClearFilters,
    isConnected,
  } = useSchedule();

  return (
    <div className="erp-page-container space-y-8 pb-16 relative">
      <PageHeader className={undefined}
        title="مخطط المواعيد الذكي"
        subtitle="إدارة المواعيد اليومية بدقة واحترافية"
        badge="جدولة العمليات"
        icon={CalendarDays}
        actions={
          <ScheduleHeaderActions
            onBackToBookings={() => navigate("/bookings")}
            onNewBooking={() => navigate("/bookings")}
          />
        }
      />

      <ScheduleStatsBar stats={stats} />

      <ContentPanel noPadding title={undefined} subtitle={undefined} actions={undefined} className={undefined}>
        <div className="p-6">
          <Toolbar
            search={search}
            setSearch={setSearch}
            barberFilter={barberFilter}
            setBarberFilter={setBarberFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            barbers={barbers}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            viewMode={viewMode}
            setViewMode={setViewMode}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            onExport={handleExport}
            live={isConnected}
            lastUpdated={lastUpdated}
            onRefresh={loadData}
            range={range}
            setRange={setRange}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
          />
        </div>
      </ContentPanel>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <ContentPanel
            title="الخريطة التشغيلية للمواعيد"
            subtitle={
              viewMode === "day"
                ? "خط زمني دقيق يعكس مدة كل خدمة. اسحب المواعيد لإعادة توزيعها بين الموظفين."
                : viewMode === "week"
                  ? "نظرة أسبوعية شاملة على توزيع المواعيد."
                  : "قائمة مفصلة بمواعيد اليوم مع كل التفاصيل."
            }
            className={cn("min-w-0")}
           actions={undefined}>
            <AnimatePresence mode="wait">
              {loading ? (
                <ScheduleLoadingSkeleton />
              ) : (
                <motion.div
                  key={`${viewMode}-${selectedDate}-${range}`}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  {viewMode === "day" && (
                    <DayBoard
                      slots={rangeConfig.slots}
                      barbers={barbersWithAppointments}
                      operatingHours={rangeConfig}
                      onDrop={() => {}}
                      draggingId={draggingId}
                      isDraggingAny={!!draggingId}
                      onOpenDetails={setSelectedAppointment}
                    />
                  )}
                  {viewMode === "week" && (
                    <WeekBoard
                      appointments={filteredAppointments}
                      selectedDate={selectedDate}
                      onOpenDetails={setSelectedAppointment}
                    />
                  )}
                  {viewMode === "list" && (
                    <ListView
                      appointments={filteredAppointments}
                      selectedDate={selectedDate}
                      onOpenDetails={setSelectedAppointment}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </ContentPanel>

          {sidebarOpen && (
            <AnimatePresence>
              <motion.div
                key="sidebar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
                className="min-w-0"
              >
                <AgendaPanel
                  selectedDate={selectedDate}
                  onSelectDay={setSelectedDate}
                  appointments={appointments}
                  barbers={barbers}
                  onOpenDetails={setSelectedAppointment}
                  isDragActive={!!draggingId}
                  onClose={() => setSidebarOpen(false)}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          <ScheduleDragPreview appointment={draggedAppointment} />
        </DragOverlay>
      </DndContext>

      <ScheduleModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}

export default function SchedulePageSafe() {
  return (
    <ErrorBoundary>
      <SchedulePage />
    </ErrorBoundary>
  );
}
