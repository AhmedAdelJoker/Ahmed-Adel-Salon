/** Reception BoardColumn (moved from ReceptionBoard page, no logic changes). */
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/core/utils";
import ReceptionEmptyState from "@/features/reception/components/ReceptionEmptyState";
import AppointmentCard from "@/features/reception/components/AppointmentCard";

export default function BoardColumn({
  col,
  items,
  loading,
  now,
  draggingId,
  dropCol,
  setDropCol,
  onDrop,
  onEdit,
  onCancel,
  onReassign,
  onUpdateStatus,
}: any) {
  const isOver = dropCol === col.key;

  const handleDragOver = (e) => {
    e.preventDefault();
    if (dropCol !== col.key) setDropCol(col.key);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-[2rem] border overflow-hidden bg-card/60 backdrop-blur-xl shadow-soft transition-all duration-300 min-h-0",
        col.theme.border,
        isOver && cn("ring-2 ring-inset bg-soft/80", col.theme.dropRing),
      )}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropCol(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        onDrop(id, col.key);
      }}
    >
      {/* Column Header */}
      <div
        className={cn(
          "shrink-0 p-3 sm:p-5 border-b flex items-center justify-between gap-2 sm:gap-3",
          col.theme.headerBg,
          col.theme.border,
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className={cn(
              "p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-sm shrink-0",
              col.theme.iconBg,
            )}
          >
            <col.icon size={14} className="sm:hidden" />
            <col.icon size={16} className="hidden sm:block" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black text-main truncate">
              {col.title}
            </h3>
            <p className="hidden sm:block text-[10px] font-bold text-muted truncate">
              {col.desc}
            </p>
          </div>
        </div>
        <Badge
          className={cn(
            "rounded-lg px-3 py-1 text-[11px] font-black shrink-0",
            col.theme.count,
          )}
        >
          {items.length}
        </Badge>
      </div>

      {/* Column Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 sm:p-3 space-y-2 sm:space-y-3">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : items.length === 0 ? (
          <ReceptionEmptyState
            icon={col.icon}
            title="القائمة فارغة"
            desc="لا يوجد عملاء في هذه المرحلة حالياً."
          />
        ) : (
          items.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              col={col}
              now={now}
              dragging={draggingId === appt.id}
              onEdit={() => onEdit(appt)}
              onCancel={() => onCancel(appt)}
              onReassign={() => onReassign(appt)}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}
