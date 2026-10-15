/**
 * useParallax — translate an element against the page scroll.
 *
 * Returns a ref to attach, not a value. That is the whole design.
 *
 * ## Why a ref and not state
 *
 * A parallax layer moves on every frame of a fling. Routing that through
 * `useState` re-renders the subtree 60 times a second, and the cost lands on
 * exactly the work this is trying to protect — layout and paint of a full-bleed
 * photograph. Writing `element.style.transform` directly mutates one composited
 * property and never reaches React at all.
 *
 * ## Why it cannot conflict with `.reveal`
 *
 * The scroll-reveal system in `index.css` animates `transform` on the same
 * elements (`.reveal[data-reveal-from]`). Two things writing `transform` to one
 * node means the last writer wins and the reveal silently stops working.
 * Parallax is therefore applied to a *different* node than any `.reveal`, and
 * the CSS custom property indirection below keeps that separation explicit:
 * parallax writes `--parallax-y`, and only the dedicated layer element
 * consumes it.
 *
 * ## The transform is read, not the offset
 *
 * `getBoundingClientRect().top` is used rather than `scrollY`, because the
 * element may not start at the document origin — a section in the middle of the
 * page has a large document offset, and measuring it means the effect is
 * anchored to the element rather than to a magic constant.
 *
 * ## It degrades to nothing
 *
 * Motion off (owner setting or the visitor's OS preference), no
 * `IntersectionObserver`, or a browser without `Element.animate` all mean the
 * layer is left at its resting position. The page is identical without it.
 */

import { useEffect, useRef } from "react";

import { useMotionEnabled } from "./useMotionEnabled";

export interface UseParallaxOptions {
  /**
   * How far the layer travels, as a fraction of the distance the element has
   * scrolled past the viewport centre. `0.12` moves it 12% — enough to read as
   * depth, small enough that the layer never outruns its own container and
   * exposes an edge.
   */
  strength?: number;
  /**
   * `ownerMotionEnabled` from the site settings. `undefined` means the field is
   * absent from the snapshot, which counts as enabled so existing salons keep
   * the current behaviour.
   */
  ownerMotionEnabled?: boolean;
  /**
   * Extra travel to give the layer in each direction, in pixels. The layer is
   * scaled up by this much so the translation never reveals an unpainted edge
   * at either end of its travel.
   */
  overscan?: number;
}

/** Attach to the layer — the element that actually moves. */
export function useParallax<T extends HTMLElement = HTMLDivElement>({
  strength = 0.12,
  ownerMotionEnabled,
  overscan = 64,
}: UseParallaxOptions = {}) {
  const layerRef = useRef<T | null>(null);
  const motionEnabled = useMotionEnabled(ownerMotionEnabled);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !motionEnabled) return undefined;

    // Fail open. An old browser without IntersectionObserver still gets a
    // static layer, which is a correct page, rather than a broken one.
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    let frame = 0;
    let visible = false;

    const paint = () => {
      frame = 0;
      if (!visible) return;

      const rect = layer.getBoundingClientRect();
      // Distance from the viewport centre, positive when the element has
      // scrolled above it. Reading the rect on a frame that has already been
      // scheduled means no forced synchronous layout happens outside the rAF
      // callback where it belongs.
      const centre = window.innerHeight / 2;
      const delta = rect.top + rect.height / 2 - centre;

      // Clamp: past this the element is off screen and the value is unused, so
      // letting it run would grow the transform without bound on a long page.
      const travel = Math.max(-1, Math.min(1, delta / centre)) * strength * 100;

      layer.style.setProperty("--parallax-y", `${travel.toFixed(2)}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };

    // The observer stops the work entirely when the layer is off screen. A
    // full-bleed hero that has scrolled past still receives scroll events
    // without this, and each one costs a rect read.
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
      },
      // A margin either side, so the layer is already painted when it scrolls
      // into view rather than starting one frame late.
      { rootMargin: "20% 0px" },
    );
    observer.observe(layer);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      // Clear the property rather than leaving a stale offset behind if the
      // owner turns motion off and this layer unmounts without a repaint.
      layer.style.removeProperty("--parallax-y");
    };
  }, [motionEnabled, strength]);

  return { layerRef, overscan };
}