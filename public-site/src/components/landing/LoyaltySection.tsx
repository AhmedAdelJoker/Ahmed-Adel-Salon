import { motion } from "framer-motion";
import { Award, Gift, Star, Crown, Sparkles, TrendingUp, Check } from "lucide-react";
import { cardMotion, staggerContainer } from "./animations";

/**
 * LoyaltySection — Loyalty program showcase.
 * - 4 tiers (Bronze → Platinum)
 * - Visual progress path
 * - CTA to join (opens MemberPortal)
 */
const TIERS = [
  {
    name: "Bronze",
    points: "0 - 199",
    color: "#CD7F32",
    icon: Award,
    benefits: ["خصم 5% على كل حجز", "إشعارات بالعروض الحصرية"],
  },
  {
    name: "Silver",
    points: "200 - 499",
    color: "#C0C0C0",
    icon: Star,
    benefits: ["خصم 10% على كل حجز", "حجز أولوية", "هدية في عيد ميلادك"],
  },
  {
    name: "Gold",
    points: "500 - 999",
    color: "#D4AF37",
    icon: Crown,
    benefits: ["خصم 15% على كل حجز", "حجز VIP فوري", "جلسة مجانية كل 10 حجوزات"],
  },
  {
    name: "Platinum",
    points: "1000+",
    color: "#E5E4E2",
    icon: Sparkles,
    benefits: ["خصم 20% على كل حجز", "حلاق خاص مخصص", "دعوات لفعاليات حصرية"],
  },
];

export default function LoyaltySection({ onJoin }) {
  return (
    <section className="py-20 px-6 relative overflow-hidden" id="loyalty">
      {/* Background decoration */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-[150px] opacity-10"
        style={{ backgroundColor: "#D4AF37" }}
      />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30">
            <Gift size={14} className="text-[#D4AF37]" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37]">
              Loyalty Program
            </p>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            برنامج الولاء الملكي
          </h2>
          <p className="text-base md:text-lg font-bold text-slate-400 max-w-2xl mx-auto leading-relaxed">
            كل حجز يكسبك نقاط. كل نقطة تقربك لمكافآت حصرية وخصومات ملكية.
          </p>
        </div>

        {/* Tiers Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {TIERS.map((tier, index) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                variants={cardMotion}
                whileHover="hover"
                className="group relative p-6 rounded-[2rem] border bg-[#17171A] border-white/10 hover:border-[#D4AF37]/30 transition-all overflow-hidden"
                style={{ borderColor: `${tier.color}30` }}
              >
                {/* Icon + Tier name */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center border"
                    style={{
                      backgroundColor: `${tier.color}15`,
                      borderColor: `${tier.color}40`,
                      color: tier.color,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight">{tier.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: tier.color }}>
                      {tier.points} pts
                    </p>
                  </div>
                </div>

                {/* Benefits list */}
                <ul className="space-y-2.5">
                  {tier.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-300 leading-relaxed">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                {/* Recommended badge on Gold */}
                {tier.name === "Gold" && (
                  <div
                    className="absolute top-4 end-4 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
                    style={{ backgroundColor: tier.color, color: "#09090B" }}
                  >
                    Most Popular
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <div className="text-center">
          <button
            type="button"
            onClick={onJoin}
            className="inline-flex items-center gap-3 h-16 px-10 rounded-2xl font-black text-base shadow-[0_20px_50px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95 transition-all"
            style={{ backgroundColor: "#D4AF37", color: "#09090B" }}
          >
            <TrendingUp size={18} />
            انضم واحصل على 100 نقطة ترحيب
            <Sparkles size={18} />
          </button>
          <p className="text-xs text-slate-500 mt-4">
            مجاني تماماً • بدون رسوم خفية • إلغاء في أي وقت
          </p>
        </div>
      </div>
    </section>
  );
}
