import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
}: QuickActionsPanelProps) => {
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
          <Button
            className="w-full h-11 rounded-xl"
            onClick={onComplete}
          >
            <CheckCircle size={16} className="ml-1.5" /> إنهاء الخدمة
          </Button>
          <Button
            variant="outline"
            className="w-full h-11 rounded-xl"
            onClick={onCancel}
          >
            <XCircle size={16} className="ml-1.5" /> إلغاء الخدمة
          </Button>
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
