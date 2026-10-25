/**
 * POS offline-sync state machine.
 *
 * Replays queued invoices when the connection returns (browser `online`
 * event) and once on mount, and exposes the small banner state the POS UI
 * needs: connection state + number of locally-pending invoices.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import {
  OfflineReplayResult,
  pendingOfflineInvoiceCount,
  replayOfflineQueue,
  subscribeOfflineQueue,
} from "./invoiceQueue";

export function useOfflineSync() {
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [pendingCount, setPendingCount] = useState(() => pendingOfflineInvoiceCount());
  const [replaying, setReplaying] = useState(false);

  const replay = useCallback(async (): Promise<OfflineReplayResult> => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { sent: 0, failed: 0, stillPending: pendingOfflineInvoiceCount(), wentOffline: true };
    }
    setReplaying(true);
    try {
      const result = await replayOfflineQueue();
      if (result.sent > 0) {
        toast.success(
          result.sent === 1
            ? "نزّلت الفاتورة المؤجلة إلى الخادم بنجاح"
            : `نزّلت ${result.sent} فواتير مؤجلة إلى الخادم بنجاح`,
        );
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} فاتورة مؤجلة رفضها الخادم — راجع تفاصيلها قبل تكرار البيع`,
          { duration: 8000 },
        );
      }
      return result;
    } finally {
      setReplaying(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Give the OS network stack a beat so the first request doesn't race it.
      window.setTimeout(() => {
        void replay();
      }, 400);
    };
    const handleOffline = () => setIsOffline(true);
    const unsubscribe = subscribeOfflineQueue(() => {
      setPendingCount(pendingOfflineInvoiceCount());
    });

    void replay();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [replay]);

  return { isOffline, pendingCount, replaying, replay };
}
