import { Award, Sparkles, ShieldCheck, Star, Crown, BadgeCheck } from "lucide-react";
import InfiniteMarquee from "./Marquee";

/**
 * TrustMarquee — Two-row infinite marquee for trust signals.
 * - Row 1: Product brand icons (L'Oréal, Schwarzkopf, etc.)
 * - Row 2: Award badges + trust labels
 */
const DEFAULT_BRANDS = [
  { name: "L'Oréal", icon: "💎" },
  { name: "Schwarzkopf", icon: "✂️" },
  { name: "Wella", icon: "🌟" },
  { name: "Olaplex", icon: "🧪" },
  { name: "Kérastase", icon: "👑" },
  { name: "Redken", icon: "🔥" },
  { name: "Goldwell", icon: "✨" },
  { name: "American Crew", icon: "🇺🇸" },
];

const DEFAULT_BADGES = [
  { label: "خدمة 5 نجوم", icon: Star },
  { label: "معقّم بالكامل", icon: ShieldCheck },
  { label: "منتجات عالمية", icon: Award },
  { label: "فنانين معتمدين", icon: BadgeCheck },
  { label: "موثوق منذ 2015", icon: Crown },
  { label: "أجواء ملكية", icon: Sparkles },
];

export default function TrustMarquee({ brands = DEFAULT_BRANDS, badges = DEFAULT_BADGES }) {
  return (
    <section
      className="py-12 sm:py-16 relative overflow-hidden"
      aria-label="علامات تجارية وشهادات الجودة"
    >
      {/* Brands Row */}
      <div className="mb-6">
        <p
          className="text-[10px] font-black uppercase tracking-[0.4em] text-center mb-6 opacity-60"
          style={{ color: "#D4AF37" }}
        >
          Brands We Trust
        </p>
        <InfiniteMarquee speed={40} gap="3rem">
          {brands.map((brand, i) => (
            <div
              key={`${brand.name}-${i}`}
              className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shrink-0 hover:border-[#D4AF37]/30 transition-colors"
            >
              <span className="text-2xl" aria-hidden="true">{brand.icon}</span>
              <span className="text-sm font-black tracking-wider text-slate-300 whitespace-nowrap">
                {brand.name}
              </span>
            </div>
          ))}
        </InfiniteMarquee>
      </div>

      {/* Trust Badges Row — opposite direction */}
      <div>
        <InfiniteMarquee speed={35} gap="2rem" className="[&_.marquee-track]:!animate-[marquee-scroll-reverse_35s_linear_infinite]">
          {badges.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <div
                key={`${badge.label}-${i}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37]/10 to-[#B08D26]/5 border border-[#D4AF37]/20 shrink-0"
              >
                <Icon size={16} className="text-[#D4AF37]" />
                <span className="text-xs font-black tracking-wide text-[#D4AF37] whitespace-nowrap">
                  {badge.label}
                </span>
              </div>
            );
          })}
        </InfiniteMarquee>
      </div>

      <style>{`
        @keyframes marquee-scroll-reverse {
          from { transform: translateX(50%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}
