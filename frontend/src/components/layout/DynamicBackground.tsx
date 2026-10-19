import React from "react";
import { usePreferences } from "@/context/PreferencesContext";

/**
 * Enterprise Background (static).
 *
 * Deliberately NOT animated. The previous version moved three 60–80vw blobs
 * with a 120px blur (plus a full-viewport noise layer) on an infinite
 * framer-motion loop for every logged-in session. That forced the compositor
 * to redraw every frame indefinitely, and on the salon's Iris Xe machines the
 * Intel display driver periodically missed its TDR timeout and Windows reset
 * it (System event log, Id 4101 "igfxn stopped responding and has recovered") —
 * the user-visible symptom was the entire screen going black for ~1 second and
 * coming back, at any time, including while idle.
 *
 * The identical composition is kept as static layers: they are rasterised
 * once and cached by the compositor. At 4–8% opacity behind everything the
 * difference is visually indistinguishable, while the per-frame GPU cost is
 * effectively zero.
 */
export default function DynamicBackground() {
  const { preferences } = usePreferences();
  const isDark = preferences?.theme === "dark";

  // Same colors/sizes as the animated version; placements are frozen and
  // spread across the viewport so the wash reads the same as before.
  const blobs = [
    {
      id: 1,
      color: isDark ? "rgba(34, 211, 238, 0.08)" : "rgba(124, 58, 237, 0.06)",
      size: "w-[80vw] h-[80vw]",
      style: { left: "-20vw", top: "-25vw" },
    },
    {
      id: 2,
      color: isDark ? "rgba(109, 40, 217, 0.06)" : "rgba(34, 211, 238, 0.04)",
      size: "w-[70vw] h-[70vw]",
      style: { right: "-15vw", bottom: "-20vw" },
    },
    {
      id: 3,
      color: isDark ? "rgba(16, 185, 129, 0.04)" : "rgba(245, 158, 11, 0.03)",
      size: "w-[60vw] h-[60vw]",
      style: { left: "15vw", top: "-12vw" },
    },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Primary Gradient Overlay */}
      <div
        className="absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          background: isDark
            ? "radial-gradient(circle at 50% -20%, #1e1b4b 0%, transparent 80%)"
            : "radial-gradient(circle at 50% -20%, #f5f3ff 0%, transparent 80%)",
        }}
      />

      {/* Ambient blobs — static layers (rasterised once, then cached) */}
      {blobs.map((blob) => (
        <div
          key={blob.id}
          className={`absolute rounded-full blur-[120px] ${blob.size}`}
          style={{
            backgroundColor: blob.color,
            ...blob.style,
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
