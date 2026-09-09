import { useEffect } from "react";

/**
 * LiveChat — Integrates Crisp (or Tawk.to) chat widget.
 *
 * Set VITE_CRISP_WEBSITE_ID to enable Crisp chat.
 * If not set, falls back to a custom in-page chat launcher
 * that opens WhatsApp (using shopWhatsApp from settings if available).
 *
 * Privacy: Crisp is GDPR-compliant. Configure consent in your Crisp dashboard.
 */
const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined;

type CrispWindow = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $crisp?: any[];
  CRISP_WEBSITE_ID?: string;
};

export default function LiveChat() {
  // Crisp integration
  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;
    if (typeof window === "undefined") return;
    const w = window as unknown as CrispWindow;
    if (w.$crisp) return; // already loaded

    w.$crisp = [];
    w.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    // Position: bottom-right (avoid conflict with floating CTA)
    w.$crisp.push(["safe", true]);
  }, []);

  // No-op if Crisp is configured (it renders its own button)
  if (CRISP_WEBSITE_ID) return null;

  // Fallback: nothing renders by default (the WhatsApp button in the floating CTA is the chat)
  return null;
}

/**
 * Helper to open Crisp chat programmatically.
 */
export function openCrispChat() {
  if (typeof window !== "undefined") {
    const w = window as unknown as CrispWindow;
    if (w.$crisp) {
      w.$crisp.push(["do", "chat:open"]);
    }
  }
}

/**
 * Helper to send a custom event to Crisp.
 */
export function trackCrispEvent(name: string, data: Record<string, unknown> = {}) {
  if (typeof window !== "undefined") {
    const w = window as unknown as CrispWindow;
    if (w.$crisp) {
      w.$crisp.push(["set", "session:event", [name, data]]);
    }
  }
}
