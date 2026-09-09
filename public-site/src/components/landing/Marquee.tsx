import { useMemo } from "react";

/**
 * InfiniteMarquee — pure-CSS horizontal infinite scroll.
 * - Duplicates children for seamless loop
 * - Pauses on hover
 * - Respects prefers-reduced-motion
 * - RTL-aware: reverse direction when dir="rtl"
 */
export default function InfiniteMarquee({
  children,
  speed = 30, // seconds for one full loop
  pauseOnHover = true,
  className = "",
  itemClassName = "",
  gap = "3rem",
}) {
  // Duplicate the children twice for seamless infinite scroll
  const duplicatedItems = useMemo(() => {
    return [children, children];
  }, [children]);

  return (
    <div
      className={`relative overflow-hidden marquee-mask ${className}`}
      dir="rtl"
    >
      <div
        className={`marquee-track flex w-max ${
          pauseOnHover ? "hover:[animation-play-state:paused]" : ""
        }`}
        style={{
          gap,
          animation: `marquee-scroll ${speed}s linear infinite`,
          willChange: "transform",
        }}
      >
        {duplicatedItems.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className="flex shrink-0"
            style={{ gap }}
            aria-hidden={groupIndex === 1 ? "true" : undefined}
          >
            {group}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(50%); }
        }
        .marquee-mask {
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%);
        }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track {
            animation: none !important;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
}
