import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import { ArrowLeft } from "lucide-react";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/barberStatus";

interface WorkStationHeaderProps {
  status: string;
  onBack: () => void;
}

export const WorkStationHeader = ({ status, onBack }: WorkStationHeaderProps) => {
  // Labels and colours come from the shared module. These two local copies
  // covered six statuses while the API writes ten, so `confirmed`,
  // `in_progress`, `done` and `no_show` rendered as the raw English key in a
  // neutral grey. The copies also disagreed with each other on `pending`.
  const statusLabels = STATUS_LABELS;
  const statusColors = STATUS_VARIANTS;


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
