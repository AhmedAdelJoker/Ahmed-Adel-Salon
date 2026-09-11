/** Customer KPI card (moved from Customers page). */
import { Card } from "@/components/ui";

export default function CustomerKpi({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="p-6 border-border border-border shadow-sm hover:shadow-xl transition-all duration-500 group">
      <div className="flex items-center gap-5">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110 ${color}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black text-main text-main">
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
