/** Customers DuplicatesAlert — counts come from GET /customers/stats. */
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DuplicatesAlert({
  groupCount,
  customerCount,
  onMerge,
}: {
  groupCount: number;
  customerCount: number;
  onMerge?: () => void;
}) {
  if (groupCount === 0) return null;
  return (
        <div
          className="p-4 rounded-2xl bg-warning/5 border border-warning/20"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Users size={18} className="text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-main">
                تم اكتشاف {groupCount} مجموعة من العملاء المكررين
              </p>
              <p className="text-[10px] font-bold text-muted">
                عملاء يتشاركون نفس رقم الهاتف — دمجهم يحفظ السجلات في مكان واحد
              </p>
            </div>
            <span className="text-xs font-black tabular-nums text-warning bg-warning/10 px-3 py-1 rounded-lg">
              {customerCount} عميل
            </span>
            {onMerge && (
              <Button
                variant="outline"
                onClick={onMerge}
                className="h-9 rounded-xl px-3 text-[10px] shrink-0"
              >
                بدء الدمج
              </Button>
            )}
          </div>
        </div>
  );
}
