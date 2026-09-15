import { Plus, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ScheduleHeaderActionsProps {
  onBackToBookings: () => void;
  onNewBooking: () => void;
}

export function ScheduleHeaderActions({
  onBackToBookings,
  onNewBooking,
}: ScheduleHeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-11 rounded-xl px-4">
            <Keyboard size={16} /> اختصارات
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[240px]">
          <DropdownMenuLabel>اختصارات لوحة المفاتيح</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            ["← / →", "تنقل بين الأيام"],
            ["T", "العودة لليوم الحالي"],
            ["D / W / V", "الجدول / الأسبوع / القائمة"],
            ["L", "إظهار/إخفاء الشريط الجانبي"],
          ].map(([k, desc]) => (
            <DropdownMenuItem
              key={k}
              className="justify-between gap-6"
              onSelect={(e) => e.preventDefault()}
            >
              <span className="text-muted text-[10px] font-bold">{desc}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-soft border border-border/60 text-[9px] font-black tabular-nums">
                {k}
              </kbd>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        onClick={onBackToBookings}
        className="h-11 rounded-xl"
      >
        العودة للحجوزات
      </Button>
      <Button
        onClick={onNewBooking}
        className="h-11 px-8 rounded-xl shadow-accent"
      >
        <Plus size={18} className="ml-2" /> حجز جديد
      </Button>
    </div>
  );
}
