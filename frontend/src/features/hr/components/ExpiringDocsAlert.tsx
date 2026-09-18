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
      className="flex flex-col gap-4 rounded-2xl border border-warning/20 bg-warning-soft p-4 text-main shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <ShieldAlert size={24} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-main sm:text-lg">تنبيه صلاحية المستندات</h3>
          <p className="mt-1 text-sm font-medium leading-relaxed text-muted">
            يوجد {expiringDocs.length} مستندات شارفت على الانتهاء خلال الـ
            15 يوماً القادمة.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-auto">
        {expiringDocs.slice(0, 3).map((doc: DocumentRecord, i) => (
          <div
            key={i}
            title={`${doc.employeeName}: ${doc.title}`}
            className="h-11 w-11 rounded-lg border border-warning/30 bg-card text-warning flex items-center justify-center font-bold text-sm shadow-sm"
          >
            {(doc as DocumentRecord).employeeName?.substring(0, 1)}
          </div>
        ))}
        {expiringDocs.length > 3 && (
          <div className="h-11 w-11 rounded-lg border border-warning/30 bg-soft text-muted flex items-center justify-center font-bold text-xs">
            +{expiringDocs.length - 3}
          </div>
        )}
      </div>
    </motion.div>
  );
}
