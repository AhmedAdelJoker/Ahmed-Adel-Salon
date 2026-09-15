/** Reception kanban board assembly (moved from ReceptionBoard page, no logic changes). */
import { COLUMNS } from "@/features/reception/constants";
import BoardColumn from "@/features/reception/components/BoardColumn";

export default function ReceptionKanbanBoard({
  columnLists,
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
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
      {COLUMNS.map((col) => (
        <div key={col.key} className="min-h-[20rem]">
          <BoardColumn
            col={col}
            items={columnLists[col.key]}
            loading={loading}
            now={now}
            draggingId={draggingId}
            dropCol={dropCol}
            setDropCol={setDropCol}
            onDrop={onDrop}
            onEdit={onEdit}
            onCancel={onCancel}
            onReassign={onReassign}
            onUpdateStatus={onUpdateStatus}
          />
        </div>
      ))}
    </div>
  );
}
