import { useScrollProgress } from "../../hooks/useScroll";

/**
 * A 2px reading-progress line welded to the bottom edge of the header.
 *
 * The rAF throttling lives in the hook; this component only renders. It is
 * `aria-hidden` because the scroll position is not information a screen reader
 * user needs announced — announcing it would produce a stream of percentages
 * on every frame.
 *
 * Both colours come from the palette custom properties, so the line follows the
 * salon rather than the call site. It previously took a `theme` prop and
 * concatenated `theme.border` with an alpha suffix, which only works for a
 * 6-digit hex and silently produced an invalid colour for any rgba border.
 */
export default function ScrollProgress() {
  const progress = useScrollProgress();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[color:var(--c-border)]"
    >
      <div
        className="h-full origin-right bg-accent will-change-transform"
        // RTL documents start at the right edge, which is why this is a scaleX
        // transform from the right rather than a percentage width from the left.
        style={{ transform: `scaleX(${progress})`, transformOrigin: "right" }}
      />
    </div>
  );
}