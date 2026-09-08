import * as React from "react";
import { cn } from "@/lib/core/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

interface TimePickerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
}

const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "اختر الوقت",
      minuteStep = 15,
      disabled = false,
      className,
      ...props
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [hour, setHour] = React.useState(() => {
      if (value) {
        const [h] = value.split(":");
        return parseInt(h, 10);
      }
      return 9;
    });
    const [minute, setMinute] = React.useState(() => {
      if (value) {
        const [, m] = value.split(":");
        return parseInt(m, 10);
      }
      return 0;
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from(
      { length: Math.floor(60 / minuteStep) },
      (_, i) => i * minuteStep,
    );

    const adjustHour = (delta: number) => {
      setHour((prev) => {
        const next = (prev + delta + 24) % 24;
        return next;
      });
    };

    const adjustMinute = (delta: number) => {
      setMinute((prev) => {
        const next = (prev + delta + 60) % 60;
        return next;
      });
    };

    const applyTime = () => {
      const h = String(hour).padStart(2, "0");
      const m = String(minute).padStart(2, "0");
      onChange?.(`${h}:${m}`);
      setOpen(false);
    };

    const formatDisplay = () => {
      if (!value) return placeholder;
      const [h, m] = value.split(":");
      const hh = parseInt(h, 10);
      const period = hh >= 12 ? "م" : "ص";
      const displayHour = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      return `${displayHour}:${m} ${period}`;
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
              value ? "text-main" : "text-muted",
              className,
            )}
            {...props}
          >
            <span className="flex items-center gap-2">
              <Clock size={16} className="text-primary/60" />
              {formatDisplay()}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[240px] p-0 rounded-2xl border border-border bg-card shadow-premium"
          align="start"
          dir="rtl"
        >
          {/* Time Display */}
          <div className="flex items-center justify-center gap-4 p-6 border-b border-border/50">
            {/* Hour */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => adjustHour(1)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronUp size={14} />
              </button>
              <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-2xl font-black text-primary tabular-nums">
                  {String(hour).padStart(2, "0")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustHour(-1)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronDown size={14} />
              </button>
              <span className="text-[9px] font-black text-muted uppercase">
                ساعة
              </span>
            </div>

            <span className="text-2xl font-black text-primary/30 mt-[-1rem]">
              :
            </span>

            {/* Minute */}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => adjustMinute(minuteStep)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronUp size={14} />
              </button>
              <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <span className="text-2xl font-black text-primary tabular-nums">
                  {String(minute).padStart(2, "0")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustMinute(-minuteStep)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronDown size={14} />
              </button>
              <span className="text-[9px] font-black text-muted uppercase">
                دقيقة
              </span>
            </div>

            {/* Period */}
            <div className="flex flex-col items-center gap-1 mt-[-1rem]">
              <div className="h-14 w-12 rounded-xl bg-soft border border-border/50 flex flex-col items-center justify-center gap-0.5">
                <span
                  className={cn(
                    "text-[10px] font-black",
                    hour >= 12 ? "text-muted" : "text-primary",
                  )}
                >
                  ص
                </span>
                <div className="h-px w-6 bg-border/50" />
                <span
                  className={cn(
                    "text-[10px] font-black",
                    hour >= 12 ? "text-primary" : "text-muted",
                  )}
                >
                  م
                </span>
              </div>
            </div>
          </div>

          {/* Quick Times */}
          <div className="p-3 space-y-2">
            <p className="text-[9px] font-black text-muted uppercase tracking-widest px-1">
              أوقات سريعة
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                "09:00",
                "10:00",
                "12:00",
                "14:00",
                "16:00",
                "18:00",
                "20:00",
                "22:00",
              ].map((time) => {
                const [h, m] = time.split(":").map(Number);
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setHour(h);
                      setMinute(m);
                      onChange?.(time);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-8 rounded-lg text-[10px] font-bold transition-all",
                      value === time
                        ? "bg-primary text-white"
                        : "bg-soft text-main hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Apply Button */}
          <div className="border-t border-border/50 p-3">
            <button
              type="button"
              onClick={applyTime}
              className="w-full h-10 rounded-xl bg-primary text-white text-sm font-black hover:opacity-90 transition-opacity"
            >
              تأكيد
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);

TimePicker.displayName = "TimePicker";

export { TimePicker };
