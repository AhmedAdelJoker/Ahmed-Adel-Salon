/** Reception header (moved from ReceptionBoard page, no logic changes). */
import { Monitor, RefreshCw, UserPlus, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PremiumUI";
import { cn } from "@/lib/core/utils";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("reception");
  return (
    <PageHeader className={undefined}
      title={t("board.title")}
      subtitle={t("board.subtitle")}
      badge={connected ? t("board.connected") : t("board.disconnected")}
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
            {connected ? t("board.connection_live") : t("board.connection_reconnecting")}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label={t("board.refresh")}
            title={t("board.refresh")}
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
            <UserPlus size={20} /> {t("board.new_client")}
          </Button>
        </div>
      }
    />
  );
}
