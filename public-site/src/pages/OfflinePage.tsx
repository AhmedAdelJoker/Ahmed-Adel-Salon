import { useEffect, useState } from "react";
import { RefreshCw, Home, WifiOff } from "lucide-react";

import { useI18n } from "../context/I18nContext";

/**
 * OfflinePage — graceful fallback when the visitor loses the connection.
 *
 * The previous version pinned `dir="rtl"` on its own wrapper, which contradicts
 * the rule that `I18nContext` owns document direction; an English visitor
 * reached this page (which is reachable while offline, by definition) and got a
 * mirrored layout. Direction is not set here.
 *
 * It also carried two `blur-[120px]`/`blur-[140px]` animated circles. On the one
 * page a visitor sees when the network is already failing, re-compositing two
 * large blurred layers is the wrong trade, so they are gone.
 */
export default function OfflinePage() {
  const { t } = useI18n();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <main id="main-content" tabIndex={-1} className="w-full max-w-md text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[length:var(--r-lg)] border border-accent-line bg-accent-wash text-accent">
          <WifiOff size={40} aria-hidden="true" />
        </div>

        <h1 className="mt-8 text-[length:var(--step-3)] font-bold leading-tight text-balance">
          {isOnline ? t("offline.reconnecting") : t("offline.title")}
        </h1>

        <p
          className="mx-auto mt-4 text-[length:var(--step-0)] leading-relaxed text-ink-soft"
          role="status"
          aria-live="polite"
        >
          {isOnline ? t("offline.bodyRetrying") : t("offline.bodyOffline")}
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-base btn-base--solid min-h-11 w-full px-6 text-[length:var(--step--1)] sm:w-auto"
          >
            <RefreshCw size={16} aria-hidden="true" />
            {t("common.retry")}
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="btn-base btn-base--outline min-h-11 w-full px-6 text-[length:var(--step--1)] sm:w-auto"
          >
            <Home size={16} aria-hidden="true" />
            {t("common.home")}
          </button>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-[length:var(--step--2)] text-ink-faint">
          {t("offline.signature")}
        </p>
      </main>
    </div>
  );
}
