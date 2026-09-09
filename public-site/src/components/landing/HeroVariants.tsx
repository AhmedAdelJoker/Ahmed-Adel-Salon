import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Star, Crown, ChevronDown, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import HeroMedia from "./HeroMedia";
import { useABTest } from "../../hooks/useABTest";
import LiveAvailabilityBadge from "./LiveAvailabilityBadge";

/**
 * HeroVariants — A/B tested hero with 3 messaging angles.
 * - Variant A: "Premium" (luxury focus)
 * - Variant B: "Urgency" (limited time + social proof)
 * - Variant C: "Trust" (ratings + awards)
 *
 * All copy is in Arabic for RTL-first experience.
 */
export default function HeroVariants({
  heroImage,
  heroVideoUrl,
  heroImageAlt,
  bookingPath,
  navigateToServices,
  salonName,
  onBookingClick,
}) {
  const { variant, track } = useABTest("hero_copy_v1", ["A", "B", "C"]);

  const config = {
    A: {
      badge: { text: "الرفاهية في كل تفصيلة", icon: Crown },
      title: "فن الحلاقة الراقية",
      titleAccent: "بلمسة ملكية",
      subtitle:
        "تجربة حلاقة فاخرة تجمع بين الحرفية التقليدية والذوق العصري الراقي.",
      ctaPrimary: "احجز تجربتك الملكية",
      ctaSecondary: "استكشف خدماتنا",
      trackLabel: "premium",
    },
    B: {
      badge: { text: "حجز فوري • متاح اليوم", icon: Sparkles },
      title: "احجز في",
      titleAccent: "30 ثانية",
      subtitle: "أكثر من 4,800 عميل اختارونا هذا الأسبوع. احجز مكانك قبل امتلاء المواعيد.",
      ctaPrimary: "احجز الآن ووفّر 20%",
      ctaSecondary: "شوف العروض",
      trackLabel: "urgency",
    },
    C: {
      badge: { text: "4.9 من 5  ·  +2,300 تقييم", icon: Star },
      title: "صالونك الموثوق",
      titleAccent: "منذ 2015",
      subtitle: "الفريق الأول في القاهرة بخبرة 15+ سنة. معتمدون من L'Oréal و Schwarzkopf.",
      ctaPrimary: "احجز أول موعد",
      ctaSecondary: "آراء العملاء",
      trackLabel: "trust",
    },
  };

  const current = config[variant] || config.A;
  const IconComponent = current.badge.icon;

  return (
    <section
      className="relative min-h-[90vh] sm:min-h-[95vh] flex items-center justify-center px-4 sm:px-6 overflow-hidden rounded-[2.5rem] sm:rounded-[3.5rem] mx-2 sm:mx-4 my-4 sm:my-6 border border-white/10 group/hero shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)]"
      data-ab-variant={variant}
      data-ab-experiment="hero_copy_v1"
    >
      <HeroMedia
        videoUrl={heroVideoUrl}
        imageUrl={heroImage}
        alt={heroImageAlt}
      />

      <div className="relative z-10 max-w-6xl mx-auto w-full text-center py-16 sm:py-20 px-2">
        <motion.div
          key={variant}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-7 sm:gap-9"
        >
          {/* Decorative divider + badge */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-px w-20 sm:w-28 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-eyebrow-ar backdrop-blur-md"
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.12)",
                color: "#D4AF37",
                border: "1px solid rgba(212, 175, 55, 0.25)",
              }}
            >
              <IconComponent size={12} className="shrink-0" />
              <span className="whitespace-nowrap">{current.badge.text}</span>
            </div>
            <div className="h-px w-20 sm:w-28 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
          </div>

          {/* Hero Title */}
          <div className="space-y-2 sm:space-y-3">
            <h1
              className="max-w-5xl mx-auto"
              data-testid="hero-title"
              style={{
                fontFamily: '"Cairo", "Tajawal", "IBM Plex Sans Arabic", system-ui, sans-serif',
                fontSize: "clamp(2.25rem, 6vw, 4.5rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                fontWeight: 900,
                textAlign: "center",
                color: "#FFFFFF",
              }}
            >
              {current.title}
            </h1>
            <div
              className="max-w-5xl mx-auto"
              data-testid="hero-title-accent"
              style={{
                fontFamily: '"Cairo", "Tajawal", "IBM Plex Sans Arabic", system-ui, sans-serif',
                fontSize: "clamp(2.25rem, 6vw, 4.5rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                fontWeight: 900,
                textAlign: "center",
                background: "linear-gradient(135deg, #f5d77a 0%, #d4af37 50%, #b08d26 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
              }}
            >
              {current.titleAccent}
            </div>
          </div>

          {/* Subtitle */}
          <p
            className="max-w-2xl mx-auto"
            data-testid="hero-subtitle"
            style={{
              fontFamily: '"Cairo", "Tajawal", "IBM Plex Sans Arabic", system-ui, sans-serif',
              color: "rgba(255, 255, 255, 0.82)",
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              fontWeight: 500,
              lineHeight: 1.8,
              textAlign: "center",
            }}
          >
            {current.subtitle}
          </p>

          {/* Live availability — real-time booking indicator */}
          <LiveAvailabilityBadge salonSlug={salonName} />
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-5 pt-8 sm:pt-10"
        >
          <Button
            onClick={() => {
              track("cta_click", { cta: "primary", label: current.trackLabel });
              if (onBookingClick) onBookingClick();
              else window.location.href = bookingPath;
            }}
            size="lg"
            data-testid="hero-cta-primary"
            className="h-16 sm:h-18 px-8 sm:px-12 rounded-2xl font-black text-base sm:text-lg border-none relative overflow-hidden group hover:scale-[1.03] active:scale-[0.98] transition-all"
            style={{
              backgroundColor: "#D4AF37",
              color: "#09090B",
              boxShadow: "var(--shadow-gold)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2.5">
              {current.ctaPrimary}
              <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          </Button>

          <Button
            onClick={() => {
              track("cta_click", { cta: "secondary", label: current.trackLabel });
              if (navigateToServices) navigateToServices();
            }}
            variant="outline"
            size="lg"
            data-testid="hero-cta-secondary"
            className="h-16 sm:h-18 px-8 sm:px-12 rounded-2xl border-white/25 text-white font-bold text-base sm:text-lg hover:bg-white/10 hover:border-white/40 transition-all backdrop-blur-xl group"
          >
            <span className="flex items-center gap-2.5">
              {current.ctaSecondary}
              <Sparkles
                size={18}
                className="text-[#D4AF37] group-hover:rotate-12 transition-transform"
              />
            </span>
          </Button>
        </motion.div>

        {/* Trust micro-line below CTAs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-6 text-[11px] font-bold text-white/50"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" />
            بدون رسوم خفية
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" />
            إلغاء مجاني حتى 4 ساعات
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" />
            تأكيد فوري
          </span>
        </motion.div>
      </div>

      {/* Scroll hint */}
      <motion.a
        href="#stats"
        aria-label="انتقل لأسفل"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 text-[#D4AF37]/60 hover:text-[#D4AF37] transition-colors"
      >
        <ChevronDown size={28} className="animate-pulse" />
      </motion.a>
    </section>
  );
}
