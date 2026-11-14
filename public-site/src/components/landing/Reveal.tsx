/**
 * Reveal — scroll-triggered entrance animation.
 *
 * Wraps a section and fades/slides it up once it enters the viewport.
 *
 * Why an IntersectionObserver rather than framer-motion's `whileInView`:
 * framer-motion is already a dependency and is used elsewhere on the site, but
 * `whileInView` still animates from a JS-computed style on the first frame,
 * which produces a visible jump on any element already in view at load (every
 * section above the fold). This observer instead applies the animation only to
 * elements that start *below* the viewport, and renders anything already on
 * screen in its final state — so there is never a flash of hidden content, and
 * if JavaScript or IO is unavailable the content is simply visible.
 *
 * The `data-reveal` opt-out matters for content that must never be invisible:
 * anything inside a `<noscript>`-adjacent flow, or a form's error summary that
 * has to be readable the moment it appears.
 *
 * When motion is off (owner setting, or the visitor's reduced-motion request),
 * this renders its children untouched — no class, no observer, no cost.
 */

import type { ElementType, ReactNode } from "react";

import { usePrefersReducedMotionQuery } from "../../hooks/useMotionEnabled";

interface RevealProps {
  children: ReactNode;
  /** Stagger in ms. Keep small: past ~120ms the delay reads as a broken page. */
  delay?: number;
  /** `up` for content, `right`/`left` for cards entering from a side. */
  from?: "up" | "right" | "left";
  as?: ElementType;
  className?: string;
}

export default function Reveal({
  children,
  delay = 0,
  from = "up",
  as: Tag = "div",
  className = "",
}: RevealProps) {
  const reduced = usePrefersReducedMotionQuery();

  // With motion off there is nothing to attach, so the element must render in
  // its final state from the very first paint. Returning the bare element here
  // is what keeps `opacity: 0` from ever being applied in the first place.
  if (reduced) {
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Tag
      className={`reveal ${className}`.trim()}
      data-reveal-from={from}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}