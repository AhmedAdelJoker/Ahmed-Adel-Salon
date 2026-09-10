import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import type { DocumentRecord } from "@/types/employee";

export default function ExpiringDocsAlert({
  expiringDocs,
}: {
  expiringDocs: DocumentRecord[];
}) {
  if (expiringDocs.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-6 rounded-[2.5rem] bg-rose-600 text-white shadow-xl shadow-rose-200 flex items-center justify-between border-4 border-white/20"
    >
      <div className="flex items-center gap-5">
        <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center animate-pulse">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h3 className="text-xl font-black">تنبيه صلاحية المستندات</h3>
          <p className="text-xs font-bold opacity-80 mt-1">
            يوجد {expiringDocs.length} مستندات شارفت على الانتهاء خلال الـ
            15 يوماً القادمة.
          </p>
        </div>
      </div>
      <div className="flex -space-x-4 space-x-reverse">
        {expiringDocs.slice(0, 3).map((doc: DocumentRecord, i) => (
          <div
            key={i}
            title={`${doc.employeeName}: ${doc.title}`}
            className="h-12 w-12 rounded-xl border-4 border-rose-600 bg-white text-rose-600 flex items-center justify-center font-black text-xs shadow-lg"
          >
            {(doc as DocumentRecord).employeeName?.substring(0, 1)}
          </div>
        ))}
        {expiringDocs.length > 3 && (
          <div className="h-12 w-12 rounded-xl border-4 border-rose-600 bg-slate-900 text-white flex items-center justify-center font-black text-[10px] shadow-lg">
            +{expiringDocs.length - 3}
          </div>
        )}
      </div>
    </motion.div>
  );
}
