import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Smartphone } from "lucide-react";

/**
 * PWAInstallPrompt — Captures the beforeinstallprompt event and shows a custom install UI.
 * - iOS Safari: detects standalone mode and shows instructions
 * - Android/Desktop: shows native install button
 * - Dismissable with localStorage persistence
 */
const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
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
        return;
      }
    } catch {
      // ignore
    }

    // Android/Desktop: beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay the prompt so it doesn't appear immediately
      setTimeout(() => setShowPrompt(true), 30000); // Show after 30s
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show prompt after delay (only if not standalone)
    if (isIOSDevice && !standalone) {
      setTimeout(() => setShowPrompt(true), 30000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
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
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-3rem)]"
          role="dialog"
          aria-label="ثبت التطبيق على هاتفك"
        >
          <div
            className="flex items-center gap-4 p-4 rounded-3xl border backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
            style={{
              backgroundColor: "rgba(23, 23, 26, 0.95)",
              borderColor: "rgba(212, 175, 55, 0.3)",
            }}
          >
            <div
              className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center border"
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.15)",
                borderColor: "rgba(212, 175, 55, 0.3)",
                color: "#D4AF37",
              }}
            >
              <Smartphone size={22} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate">ثبّت التطبيق على هاتفك</p>
              <p className="text-xs text-slate-400 leading-tight mt-0.5">
                {isIOS
                  ? "اضغط على أيقونة المشاركة ثم 'Add to Home Screen'"
                  : "وصول سريع + يعمل بدون إنترنت"}
              </p>
            </div>

            {!isIOS && deferredPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                className="h-10 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5"
                style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
              >
                <Download size={14} />
                تثبيت
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="إغلاق"
              className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
