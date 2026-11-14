import { motion, useReducedMotion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DocumentRecord } from "@/types/employee";

/**
 * A document about to expire is a name and a paper, not an initial.
 *
 * The old alert showed three anonymous circles with the first letter of the
 * employee's name, so the owner had to open the HR page anyway to learn who or
 * what was expiring. The names and document titles are now in the alert itself,
 * and the region is announced when it appears.
 */
export default function ExpiringDocsAlert({
  expiringDocs,
}: {
  expiringDocs: DocumentRecord[];
}) {
  const { t } = useTranslation("owner");
  const reduceMotion = useReducedMotion();

  if (expiringDocs.length === 0) return null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-xl border border-warning-line bg-warning-bg p-4 text-content shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <ShieldAlert size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-content">
            {t("hr.docExpiryAlert")}
          </h3>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-content-secondary">
            {t("hr.docExpiryMessage", { count: expiringDocs.length })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 self-start sm:self-auto">
        {expiringDocs.slice(0, 3).map((doc, index) => (
          <span
            key={doc.id ?? `${doc.employeeName}-${doc.title}-${index}`}
            title={[doc.employeeName, doc.title].filter(Boolean).join(": ")}
            className="inline-flex max-w-[230px] items-center gap-1.5 rounded-md border border-warning-line bg-raised px-2 py-1 text-[10px] font-semibold text-content-secondary"
          >
            <span className="truncate">{doc.employeeName || "—"}</span>
            <span className="truncate font-medium text-content-tertiary">
              {doc.title}
            </span>
          </span>
        ))}
        {expiringDocs.length > 3 && (
          <span className="inline-flex h-6 items-center rounded-md border border-warning-line bg-sunken px-2 text-[10px] font-semibold tabular-nums text-content-tertiary">
            +{expiringDocs.length - 3}
          </span>
        )}
      </div>
    </motion.div>
  );
}
