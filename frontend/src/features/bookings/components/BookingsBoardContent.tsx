import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Clock, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime12h } from "@/lib/core/utils";
import {
  getBookingCustomerName,
  timeOnly,
} from "@/features/bookings";
import BookingCardFull from "@/features/bookings/components/BookingCardFull";

export default function BookingsBoardContent({
  isLoading,
  viewMode,
  filteredBookings,
  employees,
  openEdit,
  handleChangeBookingStatus,
  handleActivateBooking,
  handleTransferToPOS,
  handleOpenCustomerProfile,
  handleRescheduleBooking,
  canEditBooking,
  actionLoading,
  handleDragStart,
  handleDrop,
  handleDragOver,
}: any) {
  return (
    <div className="p-4 sm:p-6">
      <AnimatePresence mode="wait">
        {isLoading ? (
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
                  filteredBookings.map((b: any) => (
                    <BookingCardFull
                      key={b.id}
                      booking={b}
                      onEdit={() => openEdit(b)}
                      onStatus={handleChangeBookingStatus}
                      onActivate={handleActivateBooking}
                      onTransferToPOS={handleTransferToPOS}
                      onOpenCustomer={handleOpenCustomerProfile}
                      onReschedule={(booking: any) => {
                        const newDate = prompt(
                          "أدخل التاريخ الجديد (YYYY-MM-DD):",
                          booking.appointment_date,
                        );
                        const newTime = prompt(
                          "أدخل الوقت الجديد (HH:MM):",
                          booking.appointment_time,
                        );
                        if (newDate && newTime)
                          handleRescheduleBooking(booking, newDate, newTime);
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
                {employees.map((emp: any) => {
                  const empBookings = filteredBookings.filter(
                    (b: any) => b.barber_id === emp.id,
                  );
                  const empRevenue = empBookings.reduce(
                    (sum: number, b: any) =>
                      sum + Number(b.total_estimated_price || 0),
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
                            imageUrl={undefined}
                            role={undefined}
                            className={undefined}
                          />
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
                          empBookings.map((b: any) => (
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
                                  {formatTime12h(timeOnly(b.appointment_time))}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between text-muted text-[11px] font-bold border-t border-b border-border/30 py-2 gap-2">
                                <span className="flex items-center gap-1 min-w-0 truncate">
                                  <Calendar size={12} /> {b.appointment_date}
                                </span>
                                <span className="flex items-center gap-1 text-primary shrink-0">
                                  <Clock size={12} />{" "}
                                  {b.total_estimated_duration_minutes || 30} د
                                </span>
                              </div>

                              <div className="flex justify-between items-center gap-2 pt-1">
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar min-w-0">
                                  {b.services?.map((s: any, i: number) => (
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
  );
}
