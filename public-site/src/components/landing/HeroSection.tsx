import type * as React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import HeroMedia from "./HeroMedia";

export interface HeroSectionProps {
  heroImage: string;
  heroVideoUrl?: string;
  heroImageAlt?: string;
  badge?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  bookingPath?: string;
  navigateToServices?: () => void;
  salonName?: string;
  theme?: Record<string, string | undefined>;
}

/**
 * HeroSection — Cinematic executive hero with video/image background.
 */
export default function HeroSection({
  heroImage,
  heroVideoUrl,
  heroImageAlt,
  badge,
  title,
  subtitle,
  bookingPath,
  navigateToServices,
  salonName,
  theme = {},
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[95vh] flex items-center justify-center px-6 overflow-hidden rounded-[3.5rem] mx-4 my-4 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] border border-white/10 group/hero">
      <HeroMedia
        videoUrl={heroVideoUrl}
        imageUrl={heroImage}
        alt={heroImageAlt}
      />

      <div className="relative z-10 max-w-6xl mx-auto w-full text-center space-y-10 py-20">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-8"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            <Badge
              variant="default"
              size="sm"
              className="border-none px-8 py-2 rounded-full font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl relative overflow-hidden"
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.15)",
                color: "#D4AF37",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(212, 175, 55, 0.2)",
              }}
            >
              <span className="relative z-10 animate-pulse">{badge}</span>
            </Badge>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          </div>

          <h1 className="text-5xl md:text-9xl font-black text-white tracking-tighter leading-[0.95] max-w-5xl mx-auto">
            {title}
          </h1>

          <p className="text-lg md:text-2xl text-white/70 font-bold max-w-3xl mx-auto leading-relaxed text-pretty">
            {subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap justify-center gap-6 pt-6"
        >
          <Button
            onClick={() => {
              if (bookingPath) window.location.href = bookingPath;
            }}
            size="lg"
            className="h-20 px-12 rounded-[2rem] font-black text-xl hover:scale-[1.05] active:scale-[0.98] transition-all border-none relative overflow-hidden group shadow-[0_20px_50px_rgba(212,175,55,0.3)]"
            style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
          >
            <span className="relative z-10 flex items-center gap-3">
              احجز تجربتك الملكية <ArrowLeft size={24} />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          </Button>

          <Button
            onClick={navigateToServices}
            variant="outline"
            size="lg"
            className="h-20 px-12 rounded-[2rem] border-white/20 text-white font-black text-xl hover:bg-white/10 hover:border-white/40 transition-all backdrop-blur-xl group"
          >
            <span className="flex items-center gap-3">
              استكشف الخدمات <Sparkles size={20} className="text-[#D4AF37] group-hover:rotate-12 transition-transform" />
            </span>
          </Button>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[#D4AF37]/50"
      >
        <ChevronDown size={32} className="animate-pulse" />
      </motion.div>
    </section>
  );
}
