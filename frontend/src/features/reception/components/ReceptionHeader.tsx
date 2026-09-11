/** Reception header (moved from ReceptionBoard page, no logic changes). */
import { Monitor, RefreshCw, UserPlus, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";

export default function ReceptionHeader({
  connected,
  appointmentsFetching,
  onRefresh,
  onNewClient,
}: {
  connected: boolean;
  appointmentsFetching: boolean;
  onRefresh: () => void;
  onNewClient: () => void;
}) {
  return (
    <PageHeader className={undefined}
      title="لوحة التحكم والعمليات"
      subtitle="متابعة دقيقة لمسار العميل داخل الصالون"
      badge={connected ? "متصل مباشر" : "غير متصل"}
      icon={Monitor}
      actions={
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={cn(
              "hidden lg:flex items-center gap-2 px-3 h-11 rounded-xl border text-[11px] font-black transition-all",
              connected
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
            )}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? "الاتصال الحي يعمل" : "إعادة الاتصال..."}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label="تحديث البيانات"
            title="تحديث البيانات"
            className="h-11 w-11 rounded-xl"
          >
            <RefreshCw
              size={18}
              className={appointmentsFetching ? "animate-spin" : ""}
            />
          </Button>
          <Button
            onClick={onNewClient}
            className="h-11 px-8 rounded-xl font-black bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 text-sm"
          >
            <UserPlus size={20} /> تسجيل عميل سريع
          </Button>
        </div>
      }
    />
  );
}
