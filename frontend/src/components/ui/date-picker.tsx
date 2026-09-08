import * as React from "react";
import { cn } from "@/lib/core/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["سب", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 6 ? 0 : day + 1;
}

interface DatePickerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "اختر التاريخ",
      min,
      max,
      disabled = false,
      className,
      ...props
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [viewDate, setViewDate] = React.useState(
      value ? new Date(value) : new Date(),
    );

    const selectedDate = value ? new Date(value) : null;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const selectDate = (day: number) => {
      const date = new Date(year, month, day);
      if (min && date < new Date(min)) return;
      if (max && date > new Date(max)) return;
      onChange?.(date.toISOString().split("T")[0]);
      setOpen(false);
    };

    const isToday = (day: number) => {
      const today = new Date();
      return (
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day
      );
    };

    const isSelected = (day: number) => {
      if (!selectedDate) return false;
      return (
        selectedDate.getFullYear() === year &&
        selectedDate.getMonth() === month &&
        selectedDate.getDate() === day
      );
    };

    const isDisabled = (day: number) => {
      const date = new Date(year, month, day);
      if (min && date < new Date(min)) return true;
      if (max && date > new Date(max)) return true;
      return false;
    };

    const formatDisplay = () => {
      if (!selectedDate) return placeholder;
      return selectedDate.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg-main/50 px-4 py-2 text-sm font-bold outline-none transition-all duration-300",
              "hover:border-primary/40 focus:border-primary/50 focus:ring-4 focus:ring-primary/10",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selectedDate ? "text-main" : "text-muted",
              className,
            )}
            {...props}
          >
            <span className="flex items-center gap-2">
              <CalendarDays size={16} className="text-primary/60" />
              {formatDisplay()}
            </span>
            <ChevronLeft size={14} className="text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-0 rounded-2xl border border-border bg-card shadow-premium"
          align="start"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <button
              type="button"
              onClick={prevMonth}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <div className="text-sm font-black text-main">
              {MONTHS[month]} {year}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 px-4 pt-3">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[9px] font-black uppercase tracking-wider text-muted/60 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 p-4 pt-2">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  disabled={isDisabled(day)}
                  className={cn(
                    "h-9 w-full rounded-lg text-xs font-bold transition-all duration-200",
                    "hover:scale-105 active:scale-95",
                    isSelected(day)
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : isToday(day)
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : isDisabled(day)
                          ? "text-muted/30 cursor-not-allowed"
                          : "text-main hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today button */}
          <div className="border-t border-border/50 p-3">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                selectDate(today.getDate());
                setViewDate(today);
              }}
              className="w-full h-9 rounded-lg text-xs font-black text-primary hover:bg-primary/10 transition-colors"
            >
              اليوم
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);

DatePicker.displayName = "DatePicker";

export { DatePicker };
