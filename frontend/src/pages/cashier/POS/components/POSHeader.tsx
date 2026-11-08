import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  CalendarClock,
  Clock3,
  ShoppingBag,
  Store,
  Wifi,
  WifiOff,
} from "lucide-react";
import { usePOS } from "@/features/pos";
import { isOpenShiftStatus } from "@/features/pos/utils";
import { useSalon } from "@/context/SalonContext";
import { useIntlLocale } from "@/hooks/useAppLocale";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/core/utils";
import ShiftSidebar from "@/pages/cashier/POS/components/ShiftSidebar";

interface POSHeaderProps {
  isOffline: boolean;
  pendingCount: number;
  /** Mobile only: bring the catalogue into view once a sale starts. */
  onSaleStarted?: () => void;
}

/**
 * The POS shell header.
 *
 * It owns the three things that are true for the whole screen rather than for
 * one column: which kind of sale is running, whether the shift is open, and
 * whether the station is online. The shift controls used to occupy a permanent
 * column; they now live behind one button in a dialog, which gives the
 * session queue the full right-hand column back.
 */
const POSHeader = ({
  isOffline,
  pendingCount,
  onSaleStarted,
}: POSHeaderProps) => {
  const { t } = useTranslation("pos");
  const locale = useIntlLocale();
  const { settings } = useSalon();
  const { saleMode, startSaleMode, resetPOS, currentShift, shiftLoading } =
    usePOS();
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const hasOpenShift = isOpenShiftStatus(currentShift);
  // There are only two ways to sell now: load a reception session (services)
  // or start the product-only manual sale. No quick/walk-in service sale.
  const activeMode = saleMode === "products" ? "products" : "sessions";

  const modes = [
    { id: "sessions" as const, icon: CalendarClock, label: t("header.modes.sessions") },
    { id: "products" as const, icon: ShoppingBag, label: t("header.modes.products") },
  ];

  const handleMode = (mode: "sessions" | "products") => {
    if (mode === "sessions") {
      if (saleMode !== "idle") resetPOS({ silent: true });
      return;
    }
    if (saleMode === mode) return;
    startSaleMode(mode);
    onSaleStarted?.();
  };

  const brandName =
    settings?.salon_name || settings?.salonName || t("receipt.default_shop");
  const shiftLabel = shiftLoading
    ? t("header.shift_checking")
    : hasOpenShift
      ? t("shift_sidebar.status_open")
      : t("shift_sidebar.status_closed");

  return (
    <div className="mx-2 shrink-0 rounded-2xl border border-border/60 bg-card px-2.5 py-2 shadow-sm lg:mx-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-widest text-muted">
              {brandName}
            </p>
            <h1 className="truncate text-base font-black leading-tight tracking-tight text-main sm:text-lg">
              {t("header.title")}
            </h1>
          </div>
        </div>

        <div
          className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/50 bg-soft/40 p-1 no-scrollbar lg:order-none lg:w-auto"
          role="group"
          aria-label={t("header.mode_label")}
        >
          {modes.map((mode) => {
            const isActive = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={isActive}
                aria-label={mode.label}
                onClick={() => handleMode(mode.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-black transition-colors touch-target lg:flex-none",
                  isActive
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted hover:text-main",
                )}
              >
                <mode.icon size={14} aria-hidden="true" />
                {mode.label}
                {mode.id === "sessions" && saleMode === "session" && (
                  <>
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {t("header.session_badge")}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            variant={isOffline ? "warning" : "success"}
            size="sm"
            className="hidden gap-1 sm:inline-flex"
          >
            {isOffline ? (
              <WifiOff size={10} aria-hidden="true" />
            ) : (
              <Wifi size={10} aria-hidden="true" />
            )}
            {isOffline ? t("header.offline") : t("header.online")}
          </Badge>

          {pendingCount > 0 && (
            <Badge variant="warning" size="sm" className="tabular-nums">
              {t("header.queued", { count: pendingCount })}
            </Badge>
          )}

          <button
            type="button"
            onClick={() => setShiftDialogOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={shiftDialogOpen}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-black transition-colors touch-target",
              hasOpenShift
                ? "border-success/25 bg-success/10 text-success hover:bg-success/15"
                : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15",
            )}
          >
            <Activity size={13} aria-hidden="true" />
            <span>{t("header.shift")}</span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hasOpenShift ? "bg-success" : "bg-warning",
              )}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">{shiftLabel}</span>
          </button>

          <time
            dateTime={now.toISOString()}
            aria-label={t("header.clock")}
            className="hidden items-center gap-1 rounded-lg bg-soft/50 px-2 py-2 text-[10px] font-black tabular-nums text-muted md:flex"
          >
            <Clock3 size={12} aria-hidden="true" />
            {now.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </time>
        </div>
      </div>

      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent
          className="max-h-[min(90dvh,48rem)] w-[min(96vw,34rem)] max-w-xl p-0"
          aria-describedby="pos-shift-dialog-description"
        >
          <DialogHeader className="text-start">
            <DialogTitle>{t("header.shift_dialog_title")}</DialogTitle>
            <DialogDescription id="pos-shift-dialog-description">
              {t("header.shift_dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <ShiftSidebar />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSHeader;
