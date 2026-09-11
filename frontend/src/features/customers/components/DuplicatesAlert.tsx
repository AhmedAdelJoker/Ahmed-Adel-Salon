/** Customers DuplicatesAlert (moved from Customers page, no logic changes). */
import { Users } from "lucide-react";

export default function DuplicatesAlert({
  groups,
}: {
  groups: any[][];
}) {
  if (groups.length === 0) return null;
  return (
        <div
          className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Users size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-main">
                تم اكتشاف {groups.length} مجموعة من العملاء المكررين
              </p>
              <p className="text-[10px] font-bold text-muted">
                عملاء لهم نفس رقم الهاتف - يمكن دمجهم
              </p>
            </div>
            <span className="text-xs font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-lg">
              {groups.reduce((sum, g) => sum + g.length, 0)} ���
            </span>
          </div>
        </div>
  );
}
