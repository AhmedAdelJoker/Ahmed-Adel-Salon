import { useEffect, useRef, useState } from "react";

/**
 * useScrollProgress — 0…1 progress through the document.
 *
 * Written against a rAF-throttled scroll listener rather than a React state
 * update per scroll event: the value changes on every frame of a fling, and
 * re-rendering the tree 60 times a second to move a 2px bar is the kind of
 * thing that makes a page feel cheap on a mid-range phone.
 *
 * The listener is passive, so it never blocks scrolling.
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const doc = document.documentElement;

    const measure = () => {
      frame.current = 0;
      const scrollable = doc.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = window.requestAnimationFrame(measure);
    };

    // The document height changes as lazy images and owner sections arrive, so
    // recompute on resize rather than trusting the first measurement.
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    measure();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  return progress;
}

/**
 * useScrolledPast — true once the viewport has scrolled past `threshold`.
 *
 * Used to condense the header: a full-height header on a landing page eats the
 * first screen, and shrinking it to a slim bar once the visitor has committed
 * to reading is the cheapest possible win in perceived quality.
 */
export function useScrolledPast(threshold = 24): boolean {
  const [past, setPast] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      if (frame.current) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0;
        setPast(window.scrollY > threshold);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [threshold]);

  return past;
}

/**
 * useActiveSection — scroll-spy.
 *
 * `IntersectionObserver` with `rootMargin` biased toward the top of the
 * viewport, so the highlighted nav item is the section the visitor is actually
 * reading rather than the last one that merely crossed the fold. Elements are
 * registered in one observer instead of one per section: a dozen callbacks
 * firing on every scroll frame is how a header starts to feel laggy.
 *
 * Ids that are not on the page are skipped, which is what keeps the nav honest —
 * before this existed, the header advertised `#offers` and `#team` on salons
 * that rendered neither section.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const visible = useRef(new Set<string>());

  // `ids` is a fresh array on every render in most call sites, so the observer
  // is rebuilt from a stable signature instead of from the array identity.
  const signature = ids.join("|");

  useEffect(() => {
    const elements = signature
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!elements.length) {
      setActive(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.current.add(entry.target.id);
          else visible.current.delete(entry.target.id);
        }
        // Document order decides the winner when two sections overlap, which is
        // what happens in the gap between one section ending and the next
        // starting.
        const first = elements.find((element) => visible.current.has(element.id));
        setActive(first ? first.id : null);
      },
      // Start counting 20% down the viewport and stop at 70%: the band a reader
      // is actually looking at.
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [signature]);

  return active;
}
