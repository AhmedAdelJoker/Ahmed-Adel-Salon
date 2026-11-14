import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";
import { useI18n } from "../../context/I18nContext";

/**
 * PWAInstallPrompt — Captures the beforeinstallprompt event and shows a custom install UI.
 * - iOS Safari: detects standalone mode and shows instructions
 * - Android/Desktop: shows native install button
 * - Dismissable with localStorage persistence
 */
const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Long enough not to interrupt the first impression, short enough to be seen. */
const PROMPT_DELAY_MS = 30_000;

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

export default function PWAInstallPrompt() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS. iPadOS 13+ reports itself as "Macintosh", so a touch-capable
    // Mac is treated as iOS — otherwise those visitors never see the only
    // install affordance iOS offers.
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (/macintosh/.test(userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
    setIsIOS(isIOSDevice);

    // Detect if already installed (standalone mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if user dismissed recently
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) {
        return undefined;
      }
    } catch {
      // ignore
    }

    /**
     * Both timers are tracked and cleared on unmount. They used to be
     * fire-and-forget, so the prompt could fire after the visitor navigated
     * away — setting state on an unmounted component, thirty seconds late, on
     * a page the visitor had already left.
     */
    const timers: number[] = [];
    const later = (fn: () => void, delay: number) => {
      timers.push(window.setTimeout(fn, delay));
    };

    // Android/Desktop: beforeinstallprompt
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      // Delay the prompt so it does not appear immediately
      later(() => setShowPrompt(true), PROMPT_DELAY_MS);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS has no install event, so surface the manual instructions instead.
    if (isIOSDevice && !standalone) {
      later(() => setShowPrompt(true), PROMPT_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn("Install prompt failed:", err);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  // Don't show if already installed
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showPrompt ? (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          /*
            Anchored bottom-centre and fully opaque.

            It used to sit at `bottom-24` with a translucent
            `rgba(23,23,26,0.95)` + `backdrop-blur-xl` panel. Over the hero's
            stat cards that read as a rendering glitch rather than a toast —
            the card's text showed through the backdrop filter and looked like
            overlapping type. An opaque surface cannot be mistaken for broken
            layout, and `bottom-24` keeps it clear of the sticky mobile CTA at
            `bottom-3`.
          */
          className="fixed bottom-24 start-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rtl:translate-x-1/2"
        >
          <div
            role="dialog"
            aria-label={t("pwa.title")}
            className="flex items-center gap-3 rounded-3xl border border-accent-line bg-panel p-3"
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-accent-line bg-accent/15 text-accent"
              aria-hidden="true"
            >
              <Smartphone size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{t("pwa.title")}</p>
              <p className="mt-0.5 text-xs leading-tight text-ink-soft">
                {isIOS ? t("pwa.bodyIOS") : t("pwa.bodyNative")}
              </p>
            </div>

            {!isIOS && deferredPrompt ? (
              <button
                type="button"
                onClick={handleInstall}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold uppercase tracking-wider shadow-lg transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{ backgroundColor: "var(--c-accent)", color: "var(--c-bg)" }}
              >
                <Download size={14} aria-hidden="true" />
                {t("pwa.install")}
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t("common.close")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-inset text-ink-soft transition hover:bg-rose-500/10 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>

  );
}
