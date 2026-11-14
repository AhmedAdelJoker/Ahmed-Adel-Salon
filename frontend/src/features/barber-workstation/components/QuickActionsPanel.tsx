import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { allowedTransitions } from "@/lib/barberStatus";
import {
  CheckCircle,
  XCircle,
  Timer,
  Star,
  DollarSign,
  Settings,
  Zap,
  Target,
  Trophy,
} from "lucide-react";

interface QuickActionsPanelProps {
  elapsedTime: number;
  totalProducts: number;
  appointmentTotalAmount?: number | null;
  tipAmount: string;
  formatTime: (seconds: number) => string;
  formatCurrency: (value: unknown) => string;
  audioEnabled: boolean;
  setAudioEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  onComplete: () => void;
  onCancel: () => void;
  /** The appointment's real status, so actions can respect the transition table. */
  status?: string | null;
}

export const QuickActionsPanel = ({
  elapsedTime,
  totalProducts,
  appointmentTotalAmount,
  tipAmount,
  formatTime,
  formatCurrency,
  audioEnabled,
  setAudioEnabled,
  onComplete,
  onCancel,
  status,
}: QuickActionsPanelProps) => {
  /**
   * These two buttons were rendered unconditionally.
   *
   * `onComplete` commits `ready_for_payment`, which is a *terminal* status: the
   * backend's transition table gives it no outgoing moves. So on an appointment
   * that was already finished -- one the cashier had already taken payment for,
   * or one this barber had completed and then re-opened -- the button still
   * rendered, still opened the tip dialog, collected a tip amount, and then the
   * write was rejected with 409. The barber typed a number, clicked confirm,
   * and nothing happened.
   *
   * Gating on the same table the API enforces means the control is only
   * offered when it will actually work.
   */
  const canComplete = allowedTransitions(status).includes("ready_for_payment");
  const canCancel = allowedTransitions(status).includes("cancelled");

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
          <Target size={16} className="text-primary" /> ملخص سريع
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Timer size={16} className="text-primary" />
              </div>
              <span className="text-sm font-bold text-main">
                مدة الخدمة
              </span>
            </div>
            <span className="font-mono text-lg font-black text-primary">
              {formatTime(elapsedTime)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Star size={16} className="text-warning" />
              </div>
              <span className="text-sm font-bold text-main">المنتجات</span>
            </div>
            <span className="font-mono text-lg font-black text-warning">
              {formatCurrency(totalProducts)}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign size={16} className="text-success" />
              </div>
              <span className="text-sm font-bold text-main">
                السعر الأساسي
              </span>
            </div>
            <span className="font-mono text-lg font-black text-success">
              {appointmentTotalAmount
                ? formatCurrency(appointmentTotalAmount)
                : "---"}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                <Trophy size={16} className="text-info" />
              </div>
              <span className="text-sm font-bold text-main">
                الإجمالي المتوقع
              </span>
            </div>
            <span className="font-mono text-lg font-black text-info">
              {formatCurrency(
                (appointmentTotalAmount || 0) +
                  totalProducts +
                  (Number(tipAmount) || 0),
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
          <Zap size={16} className="text-accent" /> إجراءات سريعة
        </h3>
        <div className="space-y-2">
          {canComplete && (
            <Button
              className="w-full h-11 rounded-xl"
              onClick={onComplete}
            >
              <CheckCircle size={16} className="ms-1.5" /> إنهاء الخدمة
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={onCancel}
            >
              <XCircle size={16} className="ms-1.5" /> إلغاء الخدمة
            </Button>
          )}
          {!canComplete && !canCancel && (
            <p className="text-[11px] font-bold text-muted text-center py-2">
              {status === "ready_for_payment"
                ? "تم إنهاء الخدمة — بانتظار الدفع"
                : "لا توجد إجراءات متاحة على هذا الحجز"}
            </p>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
        <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
          <Settings size={16} className="text-muted" /> إعدادات المحطة
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-main">
              صوت التنبيهات
            </span>
            <Switch
              checked={audioEnabled}
              onCheckedChange={setAudioEnabled}
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-main">
              الاهتزاز عند الانتهاء
            </span>
            <Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-bold text-main">
              الحفظ التلقائي للملاحظات
            </span>
            <Switch defaultChecked />
          </label>
        </div>
      </div>
    </div>
  );
};
