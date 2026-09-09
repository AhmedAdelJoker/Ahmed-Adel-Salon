import {
  Activity,
  Clock,
  CreditCard,
  LayoutGrid,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BookingsHeaderActions({
  viewMode,
  setViewMode,
  onNavigate,
  onWalkIn,
  onCreate,
}: {
  viewMode: string;
  setViewMode: (v: string) => void;
  onNavigate: (path: string) => void;
  onWalkIn: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
      <Button
        variant="outline"
        onClick={() => onNavigate("/reception-board")}
        className="h-10 sm:h-11 px-3 text-xs font-black shadow-sm flex items-center gap-1.5 shrink-0"
        title="الذهاب للوحة الاستقبال المباشرة"
      >
        <Users size={16} className="text-indigo-500 shrink-0" />
        <span className="whitespace-nowrap">لوحة الاستقبال</span>
      </Button>

      <Button
        variant="outline"
        onClick={() => onNavigate("/pos")}
        className="h-10 sm:h-11 px-3 text-xs font-black shadow-sm flex items-center gap-1.5 shrink-0"
        title="نقطة البيع الكاشير"
      >
        <CreditCard size={16} className="text-emerald-500 shrink-0" />
        <span className="whitespace-nowrap">الكاشير (POS)</span>
      </Button>

      <Button
        variant={(viewMode === "board" ? "default" : "outline") as any}
        onClick={() => setViewMode(viewMode === "grid" ? "board" : "grid")}
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
        onClick={() => onNavigate("/schedule")}
        className="h-10 sm:h-11 px-3 sm:px-4 text-xs font-black shadow-sm flex items-center gap-2 shrink-0"
      >
        <Clock size={16} />
        <span className="whitespace-nowrap">المخطط الزمني</span>
      </Button>

      <Button
        variant="outline"
        onClick={onWalkIn}
        className="h-10 sm:h-11 px-3 sm:px-5 text-xs font-black flex items-center gap-2 shrink-0 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
      >
        <UserPlus size={16} />
        <span className="whitespace-nowrap">عميل مشاة</span>
      </Button>

      <Button
        onClick={onCreate}
        className="h-10 sm:h-11 px-5 sm:px-8 text-xs font-black shadow-accent flex items-center gap-2 shrink-0"
      >
        <Plus size={18} />
        <span className="whitespace-nowrap">حجز موعد جديد</span>
      </Button>
    </div>
  );
}
