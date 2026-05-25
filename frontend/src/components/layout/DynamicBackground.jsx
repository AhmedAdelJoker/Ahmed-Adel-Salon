import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePreferences } from "../../context/PreferencesContext";

/**
 * Enterprise Living Background
 * Provides a high-end, subtle, and slow-moving aesthetic.
 * Uses Framer Motion for hardware-accelerated performance.
 */
export default function DynamicBackground() {
  const { preferences } = usePreferences();
  const isDark = preferences?.theme === "dark";

  // Blob configurations for a sophisticated look
  const blobs = useMemo(
    () => [
      {
        id: 1,
        color: isDark ? "rgba(34, 211, 238, 0.08)" : "rgba(124, 58, 237, 0.06)",
        size: "w-[80vw] h-[80vw]",
        initial: { x: "-20%", y: "-20%", scale: 1 },
        animate: {
          x: ["-20%", "20%", "-20%"],
          y: ["-20%", "10%", "-20%"],
          scale: [1, 1.2, 1],
        },
        duration: 35,
      },
      {
        id: 2,
        color: isDark ? "rgba(109, 40, 217, 0.06)" : "rgba(34, 211, 238, 0.04)",
        size: "w-[70vw] h-[70vw]",
        initial: { x: "40%", y: "40%", scale: 1.1 },
        animate: {
          x: ["40%", "10%", "40%"],
          y: ["40%", "-10%", "40%"],
          scale: [1.1, 0.9, 1.1],
        },
        duration: 45,
      },
      {
        id: 3,
        color: isDark ? "rgba(16, 185, 129, 0.04)" : "rgba(245, 158, 11, 0.03)",
        size: "w-[60vw] h-[60vw]",
        initial: { x: "10%", y: "10%", scale: 0.9 },
        animate: {
          x: ["10%", "-30%", "10%"],
          y: ["10%", "50%", "10%"],
          scale: [0.9, 1.15, 0.9],
        },
        duration: 40,
      },
    ],
    [isDark],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Primary Gradient Overlay */}
      <div 
        className="absolute inset-0 opacity-40 dark:opacity-20" 
        style={{ 
          background: isDark 
            ? "radial-gradient(circle at 50% -20%, #1e1b4b 0%, transparent 80%)"
            : "radial-gradient(circle at 50% -20%, #f5f3ff 0%, transparent 80%)"
        }}
      />

      {/* Living Blobs */}
      {blobs.map((blob) => (
        <motion.div
          key={blob.id}
          className={`absolute rounded-full blur-[120px] ${blob.size}`}
          style={{ 
            backgroundColor: blob.color,
            left: "50%",
            top: "50%",
            marginLeft: `-${parseInt(blob.size) / 2}vw`,
            marginTop: `-${parseInt(blob.size) / 2}vw`,
          }}
          initial={blob.initial}
          animate={blob.animate}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* High-End Film Grain / Noise Overlay */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
