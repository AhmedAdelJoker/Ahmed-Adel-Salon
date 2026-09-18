import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/core/utils";
import { ROW_HEIGHT, ROW_BLOCK } from "@/pages/cashier/schedule/scheduleUtils";

export interface SlotDropZoneProps {
  barberId: string | number;
  slot: string;
  isDragActive: boolean;
  onDrop: (barberId: string | number, slot: string) => void;
  hasAppointment: boolean;
  index: number;
}

export function SlotDropZone({
  barberId,
  slot,
  isDragActive,
  onDrop,
  hasAppointment,
  index,
}: SlotDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${barberId}:${slot}`,
    data: { type: "slot", barberId, slot },
  });

  const highlighted = isDragActive && isOver;

  return (
    <div
      ref={setNodeRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(barberId, slot);
      }}
      className={cn(
        "absolute right-0 left-0 rounded-xl border-l border-r border-dashed transition-all duration-200 group",
        highlighted
          ? "bg-accent/15 border-accent shadow-premium z-20"
          : "border-transparent hover:bg-accent/[0.04]",
        hasAppointment && "pointer-events-none",
      )}
      style={{ top: index * ROW_BLOCK, height: ROW_HEIGHT }}
      role="gridcell"
      aria-label={`خانة ${slot} - موظف رقم ${barberId}`}
    >
      {!hasAppointment && highlighted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30">
            <Plus size={20} strokeWidth={3} />
          </div>
          <span className="text-[9px] font-black text-accent mt-2 tracking-widest">
            أفلت هنا
          </span>
        </div>
      )}
    </div>
  );
}

export default SlotDropZone;
