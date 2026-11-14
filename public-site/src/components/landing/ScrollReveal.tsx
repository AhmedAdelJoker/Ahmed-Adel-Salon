/**
 * ScrollReveal — the one place that turns `data-reveal` into visible content.
 *
 * Sets `js-reveal-ready` on <html> *before* observing, which is the ordering the
 * CSS depends on: the hidden state is gated behind that class, so adding it
 * cannot un-hide anything, and removing it (or never adding it) leaves the page
 * fully readable. That makes the entire feature fail-open — if this module
 * throws, is tree-shaken, or never loads, the site is still correct.
 *
 * Elements are revealed once and then unobserved: a long page can hold dozens of
 * revealed nodes, and leaving the observer attached costs a callback per scroll
 * frame for content that will never animate again. This also means scrolling
 * back up does not re-hide anything, which is the behaviour readers expect.
 */

import { useEffect } from "react";

const READY_CLASS = "js-reveal-ready";
const REVEALED_CLASS = "is-revealed";

/** How much of the element must be visible before it animates in. */
const THRESHOLD = 0.12;
const ROOT_MARGIN = "0px 0px -8% 0px";

export default function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof IntersectionObserver === "undefined") {
      // No observer: do not set the ready class, so nothing is ever hidden.
      return;
    }

    const targets = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.classList.add(REVEALED_CLASS);
          observer.unobserve(el);
        }
      },
      { threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
    );

    // Mark anything already on screen as revealed before the first paint of
    // the transition, so above-the-fold content is never seen sliding in.
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add(REVEALED_CLASS);
      } else {
        observer.observe(el);
      }
    }

    root.classList.add(READY_CLASS);
    return () => {
      observer.disconnect();
      root.classList.remove(READY_CLASS);
    };
  }, []);

  return null;
}