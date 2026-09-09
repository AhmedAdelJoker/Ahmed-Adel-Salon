import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { buildSrcSet, buildSizes } from "../../lib/imageOptimizer";

/**
 * HeroMedia — Smart media container for the hero.
 * - Renders a muted/autoplay/loop video when videoUrl is provided
 * - Falls back to the optimized image (with srcSet) otherwise
 * - Always shows the image as a poster so the LCP image is the hero image
 * - Pauses video when tab is hidden (saves battery)
 * - Respects prefers-reduced-motion
 */
export interface HeroMediaProps {
  videoUrl?: string;
  imageUrl: string;
  alt?: string;
  fetchpriority?: string;
}

export default function HeroMedia({
  videoUrl,
  imageUrl,
  alt = "Hero",
  fetchpriority = "high",
}: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibility = () => {
      if (document.hidden) {
        video.pause();
      } else if (!reduceMotion) {
        video.play().catch(() => {
          // Autoplay rejected — silently keep paused
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [reduceMotion]);

  const shouldRenderVideo = Boolean(videoUrl) && !reduceMotion;

  return (
    <motion.div
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 z-0"
    >
      {/* Poster image — ALWAYS present, used as LCP */}
      <img
        src={imageUrl}
        srcSet={buildSrcSet(imageUrl, [640, 960, 1280, 1600, 1920]) || undefined}
        sizes={buildSizes("100vw")}
        className={`h-full w-full object-cover transform transition-transform duration-[10s] group-hover/hero:scale-110 ${
          videoReady && shouldRenderVideo ? "opacity-0" : "opacity-100"
        } transition-opacity duration-700`}
        alt={alt}
        fetchPriority={fetchpriority as "high" | "low" | "auto"}
        decoding="async"
        width={1920}
        height={1080}
      />

      {/* Video overlay — only when supported */}
      {shouldRenderVideo && (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={imageUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Luxury gradients on top of media */}
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#09090B]" />

      {/* Luxury Light Rays/Blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#D4AF37] opacity-[0.07] blur-[150px] -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#B08D26] opacity-[0.05] blur-[120px] translate-y-1/2 -translate-x-1/2" />
    </motion.div>
  );
}
