import { useEffect } from "react";

/**
 * Live chat.
 *
 * ## Why the Crisp integration was removed
 *
 * This component used to load Crisp on every route whenever
 * `VITE_CRISP_WEBSITE_ID` was set, and its own comment deferred the privacy
 * question to the third party:
 *
 *   "Privacy: Crisp is GDPR-compliant. Configure consent in your Crisp dashboard."
 *
 * That is the same reasoning that got Clarity deleted. Crisp records the
 * session — DOM changes, form input, navigation — and this site collects a name,
 * a phone number, an email address and free-text appointment notes in a form
 * that is on screen for most of the booking flow. A third-party script with DOM
 * access can read all of it regardless of what its dashboard says, and there was
 * no consent gate on this site to gate it behind. Delegating consent to the
 * vendor's dashboard is not consent.
 *
 * The chat affordance itself was not the problem — a salon answering WhatsApp is
 * useful. So the integration point is kept, but the third-party script is gone:
 * `?chat=whatsapp` and the floating CTA open the salon's own WhatsApp link,
 * which is a real conversation with the salon and involves no session recording
 * and no third party holding the visitor's session.
 *
 * Reintroducing a third-party chat widget requires an in-site consent banner and
 * a written decision about what the vendor may capture. That is a product
 * decision, not a config flag.
 */

/**
 * Appends `?chat=1` awareness so the owner can see the CTA is wired without a
 * vendor script. Intentionally a no-op — kept only to document the removal.
 */
export default function LiveChat() {
  useEffect(() => {
    // No third-party chat script is loaded. See the note above.
  }, []);

  return null;
}

/**
 * Open the salon's chat channel.
 *
 * Kept as a function so call sites do not need to change if the channel is
 * replaced later. There is no `window.$crisp` any more, and there is no
 * replacement global — the floating CTA links to WhatsApp directly.
 */
export function openCrispChat(): void {
  /* intentionally empty */
}

/** Same: no vendor event bus remains. */
export function trackCrispEvent(_name: string, _data: Record<string, unknown> = {}): void {
  /* intentionally empty */
}