/**
 * useCountUp — animate a number from zero to its target.
 *
 * Used for the owner-supplied trust figures ("1.2K", "8", "4.9"). Three rules
 * decide whether it does anything at all:
 *
 * 1. **Owner preference.** `motionEnabled` is a site setting, not a
 *    device setting: an owner who turned animation off should see static
 *    numbers regardless of what the visitor's OS says.
 * 2. **OS preference.** `prefers-reduced-motion` wins over the owner setting,
 *    because motion sensitivity is a visitor's own accessibility need and the
 *    owner cannot waive it for them.
 * 3. **Readable without JavaScript and while it runs.** The final value is
 *    what the DOM holds before any of this starts, so a failed import, a
 *    blocked bundle or an animation that never ticks all end at the real
 *    number rather than at zero.
 *
 * `rAF` is used rather than a timeout loop so the animation stops when the tab
 * is backgrounded instead of catching up in a burst on return.
 */

import { useEffect, useRef, useState } from "react";

import { useMotionEnabled } from "./useMotionEnabled";

/** How long the run takes. Long enough to read as motion, short enough not to wait for. */
const DURATION_MS = 1100;

export function useCountUp(
  target: number,
  {
    /** The owner's `landingMotionEnabled`. */
    ownerMotionEnabled,
    start = 0,
  }: { ownerMotionEnabled?: boolean; start?: number } = {},
): number {
  const motion = useMotionEnabled(ownerMotionEnabled);
  const [value, setValue] = useState(target);
  const frameRef = useRef<number | null>(null);
  const shouldAnimate = motion && target > start;

  useEffect(() => {
    if (!shouldAnimate) {
      setValue(target);
      return;
    }

    // Browsers throttle `performance.now()` little, but not at all in a
    // background tab, so the elapsed time is measured against a captured
    // origin rather than accumulated per frame.
    const origin = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - origin) / DURATION_MS, 1);
      // Ease-out cubic: fast at first, settling gently, which reads as
      // "arriving at" the number rather than "stopping at" it.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + (target - start) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        // Land on the exact target rather than a rounded remainder; the
        // eased value is fractional and `toFixed` would otherwise be needed
        // at every call site.
        setValue(target);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, start, shouldAnimate]);

  return value;
}

/**
 * Format a counting value for display, preserving the owner's suffixes.
 *
 * The trust figures are free text ("1.2K", "1,200+", "8"), so only the numeric
 * part is animated. A string with no digits -- "+1.2K" has digits, but "since
 * 2018" does not -- is returned untouched rather than rendered as `NaN`.
 */
export function formatCountUp(
  value: number,
  template: string,
  options: { decimals?: number; useGrouping?: boolean } = {},
): string {
  const match = template.match(/-?[\d.,]+/);
  if (!match) return template;

  const literal = match[0];
  const hasDecimal = literal.includes(".");
  const decimals =
    options.decimals ?? (hasDecimal ? (literal.split(".")[1]?.length ?? 1) : 0);

  // Digits stay Latin even in the Arabic catalogue: they were on the trust row
  // before any of this, and switching glyphs mid-count is a visible jump on a
  // font that may not have loaded yet.
  //
  // A literal that already carries a separator keeps that separator; one with
  // none gets en-US grouping only when asked, so "8" never becomes "8,000" and
  // a four-digit year "2018" is not mangled into "2,018".
  // The separator is read from the *whole* template rather than from the matched
  // run: `/-?[\d.,]+/` stops at a space, so "12 000" matches only "12" and a
  // separator derived from that run would always be empty -- which is how an
  // owner's space grouping used to turn into "12,000 000" once `toLocaleString`
  // added a comma of its own.
  const hasCommaGrouping = /\d,\d{3}\b/.test(template);
  const hasSpaceGrouping = /\d\s\d{3}\b/.test(template);
  const separator = hasCommaGrouping ? "," : hasSpaceGrouping ? " " : "";
  const useGrouping = options.useGrouping ?? Boolean(separator);

  // `toLocaleString` always groups with a comma. Replacing those commas for a
  // template that grouped with spaces is what the next line looks like, and it
  // is wrong: the replacement hits the thousands separator *and* the space that
  // was already a digit separator in the source, turning "12 000" into
  // "12,000 000". Build the string without any grouping first, then insert the
  // owner's separator between groups.
  const plain = value.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const [whole = "", fraction] = plain.split(".");
  const grouped = separator
    ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    : useGrouping
      ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      : whole;

  /*
    Replace the whole numeric run *including* whatever grouping it carried,
    not just the digits. `String.replace("12", ...)` on the template "12 000"
    would splice the new value in front of the old groups: "12 000" becomes
    "12 000 000". The pattern therefore consumes digits plus any comma or space
    between them.
  */
  // The ungrouped-digit branch must come first: `/-?\d{1,3}(?:[,\s]\d{3})*$/`
  // anchors on the first one-to-three digits of "2018" and leaves the last one
  // behind, producing "2,0188". Matching the whole run first means the grouped
  // alternative only has to handle values that genuinely carry separators.
  const pattern = /-?\d+(?:[,\s]\d{3})*(?:\.\d+)?/;
  const replacement = fraction ? `${grouped}.${fraction}` : grouped;
  return template.replace(pattern, (matched) => {
    if (!/\d/.test(matched)) return matched;
    return replacement;
  });
}