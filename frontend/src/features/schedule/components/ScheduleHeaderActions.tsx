import { Plus, Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("schedule");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-11 rounded-xl px-4">
            <Keyboard size={16} /> {t("headerActions.shortcuts")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[240px]">
          <DropdownMenuLabel>{t("headerActions.shortcutsLabel")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            ["← / →", t("headerActions.navDays")],
            ["T", t("headerActions.today")],
            [
              "D / W / V",
              `${t("headerActions.viewDay")} / ${t("headerActions.viewWeek")} / ${t("headerActions.viewList")}`,
            ],
            ["L", t("headerActions.toggleSidebar")],
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
        {t("headerActions.backToBookings")}
      </Button>
      <Button
        onClick={onNewBooking}
        className="h-11 px-8 rounded-xl shadow-accent"
      >
        <Plus size={18} className="ms-2" /> {t("headerActions.newBooking")}
      </Button>
    </div>
  );
}
