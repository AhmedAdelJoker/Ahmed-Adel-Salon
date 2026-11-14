import { AnimatePresence, motion } from "framer-motion";
import { Archive, RotateCcw, Clipboard, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  /** Number of rows selected on this page. */
  count: number;
  /** "active" tab archives the selection; "archived" tab restores it. */
  mode: "active" | "archived";
  busy: boolean;
  onArchiveOrRestore: () => void;
  onCopyPurchaseList: () => void;
  onClear: () => void;
}

/**
 * The bulk-operation rail. Appears only while something is selected, with the
 * selected count always visible -- a bulk action on an invisible selection is
 * how the wrong shelf ends up archived.
 */
export function BulkActionBar({
  count,
  mode,
  busy,
  onArchiveOrRestore,
  onCopyPurchaseList,
  onClear,
}: BulkActionBarProps) {
  const { t } = useTranslation("owner");

  return (
    <AnimatePresence>
      {count > 0 && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-premium backdrop-blur"
          >
            <span className="inline-flex h-8 items-center rounded-lg bg-primary/10 px-2.5 text-[11px] font-black tabular-nums text-primary">
              {t("inventory.bulkSelected", { count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 rounded-xl text-[11px]"
              onClick={onArchiveOrRestore}
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={13} className="me-1.5 animate-spin" />
              ) : mode === "active" ? (
                <Archive size={13} className="me-1.5" />
              ) : (
                <RotateCcw size={13} className="me-1.5" />
              )}
              {mode === "active"
                ? t("inventory.bulkArchive")
                : t("inventory.bulkRestore")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-[11px]"
              onClick={onCopyPurchaseList}
              disabled={busy}
              title={t("inventory.purchaseCopyTitle")}
            >
              <Clipboard size={13} className="me-1.5" />
              {t("inventory.purchaseCopyTitle")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-xl p-0"
              onClick={onClear}
              disabled={busy}
              aria-label={t("inventory.bulkClear")}
              title={t("inventory.bulkClear")}
            >
              <X size={15} />
            </Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default BulkActionBar;
