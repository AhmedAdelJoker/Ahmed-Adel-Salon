/** Customer KPI card (moved from Customers page). */
import { Card } from "@/components/ui";

export default function CustomerKpi({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-3 sm:p-5 border-border shadow-sm hover:shadow-xl transition-all duration-500 group">
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110 ${color}`}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black uppercase tracking-widest text-muted">
            {label}
          </div>
          <div className="mt-0.5 text-lg sm:text-2xl font-black text-main">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
