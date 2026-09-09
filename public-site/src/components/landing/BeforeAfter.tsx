import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowLeftRight } from "lucide-react";
import { buildSrcSet, buildSizes } from "../../lib/imageOptimizer";

/**
 * BeforeAfter — Interactive image comparison slider.
 * - Drag the handle to compare before/after
 * - Touch-friendly
 * - Keyboard accessible (arrow keys when focused)
 * - Lazy loads both images
 * - RTL-aware: handle position reverses
 */
export interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
  className?: string;
  initialPosition?: number;
}

export default function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeAlt = "قبل",
  afterAlt = "بعد",
  className = "",
  initialPosition = 50,
}: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState(initialPosition); // 0-100
  const [isDragging, setIsDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // In RTL, the visual position is mirrored
    const isRTL = document.documentElement.dir === "rtl";
    const raw = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(0, Math.min(100, raw));
    setPosition(isRTL ? 100 - clamped : clamped);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const x =
        "touches" in e && e.touches && (e.touches as TouchList).length > 0
          ? (e.touches as TouchList)[0].clientX
          : (e as MouseEvent).clientX;
      updatePosition(x);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging, updatePosition]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPosition((p) => Math.max(0, p - 5));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPosition((p) => Math.min(100, p + 5));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPosition(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPosition(100);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-3xl overflow-hidden select-none cursor-ew-resize border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.4)] ${className}`}
      onMouseDown={(e) => {
        setIsDragging(true);
        updatePosition(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        updatePosition(e.touches[0].clientX);
      }}
    >
      {/* After image (full background) */}
      <img
        src={afterUrl}
        srcSet={buildSrcSet(afterUrl, [480, 768, 1024, 1440]) || undefined}
        sizes={buildSizes("(max-width: 768px) 100vw, 80vw")}
        alt={afterAlt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={beforeUrl}
          srcSet={buildSrcSet(beforeUrl, [480, 768, 1024, 1440]) || undefined}
          sizes={buildSizes("(max-width: 768px) 100vw, 80vw")}
          alt={beforeAlt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* Labels */}
      <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-[#D4AF37] border border-[#D4AF37]/30 z-10">
        {afterAlt}
      </span>
      <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white border border-white/20 z-10">
        {beforeAlt}
      </span>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-[3px] bg-[#D4AF37] pointer-events-none z-10"
        style={{
          left: `${position}%`,
          transform: "translateX(-50%)",
          boxShadow: "0 0 20px rgba(212,175,55,0.6)",
        }}
      />

      {/* Handle */}
      <button
        ref={handleRef}
        type="button"
        role="slider"
        aria-label="اسحب للمقارنة بين قبل وبعد"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="absolute top-1/2 z-20 h-14 w-14 rounded-full bg-white border-4 border-[#D4AF37] shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex items-center justify-center cursor-ew-resize hover:scale-110 active:scale-95 transition-transform focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/40"
        style={{
          left: `${position}%`,
          transform: "translate(-50%, -50%)",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowLeftRight size={20} className="text-[#D4AF37]" />
      </button>
    </div>
  );
}
