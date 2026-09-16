import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import { ArrowLeft } from "lucide-react";

interface WorkStationHeaderProps {
  status: string;
  onBack: () => void;
}

export const WorkStationHeader = ({ status, onBack }: WorkStationHeaderProps) => {
  const statusLabels: Record<string, string> = {
    waiting: "في الانتظار",
    "in-service": "قيد الخدمة",
    completed: "مكتمل",
    ready_for_payment: "جاهز للدفع",
    cancelled: "ملغي",
    pending: "قيد التأكيد",
  };

  const statusColors: Record<string, "warning" | "info" | "success" | "danger" | "secondary"> = {
    waiting: "warning",
    "in-service": "info",
    completed: "success",
    ready_for_payment: "success",
    cancelled: "danger",
    pending: "secondary",
  };

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={onBack}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-xl font-black text-main">محطة العمل</h1>
              <p className="text-sm text-muted">جلسة خدمة نشطة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                "h-8 px-3 text-xs font-black",
                statusColors[status] || "secondary",
              )}
            >
              {statusLabels[status] || status}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
