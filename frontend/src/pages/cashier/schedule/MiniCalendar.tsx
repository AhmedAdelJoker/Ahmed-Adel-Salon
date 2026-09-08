import { memo, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/core/utils";
import { normalizeStatus } from "@/pages/cashier/schedule/scheduleUtils";
import { ChevronLeft, ChevronRight } from "lucide-react";

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

const DAY_LABELS = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

function DayCell({
  day,
  dateStr,
  counts,
  selected,
  isToday,
  isDropTarget,
  onSelectDay,
}: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: { type: "day", date: dateStr },
    disabled: day === null,
  });

  const highlighted = isDropTarget && isOver;

  return (
    <div
      ref={setNodeRef}
      onClick={() => day !== null && onSelectDay?.(dateStr)}
      className={cn(
        "relative h-9 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
        day === null && "pointer-events-none opacity-0",
        isToday && "ring-2 ring-accent/40 bg-accent/5",
        selected &&
          !isToday &&
          "bg-accent text-white shadow-md shadow-accent/30",
        selected &&
          isToday &&
          "bg-accent text-white shadow-md shadow-accent/30 ring-0",
        !selected && !isToday && "hover:bg-soft text-main",
        highlighted && "bg-accent/20 ring-2 ring-accent",
      )}
      role="gridcell"
      aria-label={day === null ? "" : `يوم ${day}`}
      aria-selected={selected}
      title={
        counts.total > 0
          ? `${counts.total} مواعيد${counts.confirmed > 0 ? ` (${counts.confirmed} مؤكد)` : ""}`
          : "لا توجد مواعيد"
      }
    >
      {day !== null && (
        <>
          <span
            className={cn(
              "text-[11px] font-black leading-none",
              selected ? "text-white" : "",
            )}
          >
            {day}
          </span>
          <span className="flex items-center gap-0.5 mt-1">
            {counts.confirmed > 0 && (
              <span className="w-1 h-1 rounded-full bg-amber-500" />
            )}
            {counts.pending > 0 && (
              <span className="w-1 h-1 rounded-full bg-blue-500" />
            )}
            {counts.progress > 0 && (
              <span className="w-1 h-1 rounded-full bg-indigo-500" />
            )}
            {counts.total > 0 &&
              counts.confirmed === 0 &&
              counts.pending === 0 &&
              counts.progress === 0 && (
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
              )}
          </span>
        </>
      )}
    </div>
  );
}

const MiniCalendar = memo(function MiniCalendar({
  selectedDate,
  onSelectDay,
  appointments,
  isDragActive,
}: any) {
  const todayStr = formatDateInput(new Date());
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1);
  });

  const countsByDate = useMemo(() => {
     
    const map: Record<string, any> = {};
    for (const appt of appointments) {
      const date = appt.appointment_date || appt.appointmentDate;
      if (!date) continue;
      if (!map[date])
        map[date] = { total: 0, confirmed: 0, pending: 0, progress: 0 };
      const s = normalizeStatus(appt.status);
      map[date].total += 1;
      if (s === "CONFIRMED") map[date].confirmed += 1;
      else if (["IN_PROGRESS", "AT_RECEPTION", "AT_CASHIER"].includes(s))
        map[date].progress += 1;
      else if (s === "WAITING") map[date].pending += 1;
    }
    return map;
  }, [appointments]);

  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const satOffset = (first.getDay() + 1) % 7; // Saturday-first week
     
    const cells: any[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < satOffset; i++) cells.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = formatDateInput(new Date(year, month, d));
      cells.push({ day: d, dateStr: date });
    }

    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString("ar-EG", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-soft text-muted hover:text-accent hover:bg-card transition-all border border-border/60"
          aria-label="الشهر السابق"
        >
          <ChevronRight size={16} />
        </button>
        <p className="text-sm font-black text-main">{monthLabel}</p>
        <button
          onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-lg bg-soft text-muted hover:text-accent hover:bg-card transition-all border border-border/60"
          aria-label="الشهر التالي"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[9px] font-black text-muted uppercase tracking-wider py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, i) =>
          cell ? (
            <DayCell
              key={cell.dateStr}
              day={cell.day}
              dateStr={cell.dateStr}
              counts={
                countsByDate[cell.dateStr] || {
                  total: 0,
                  confirmed: 0,
                  pending: 0,
                  progress: 0,
                }
              }
              selected={cell.dateStr === selectedDate}
              isToday={cell.dateStr === todayStr}
              isDropTarget={isDragActive}
              onSelectDay={onSelectDay}
            />
          ) : (
            <div key={`empty-${i}`} />
          ),
        )}
      </div>
    </div>
  );
});

export default MiniCalendar;
