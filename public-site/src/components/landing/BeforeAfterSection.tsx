import { motion } from "framer-motion";
import { Sparkles, Camera } from "lucide-react";
import BeforeAfter from "./BeforeAfter";

/**
 * BeforeAfterSection — Showcase transformations with side-by-side comparisons.
 * Drives the highest conversion in beauty/grooming websites.
 */
const DEFAULT_TRANSFORMATIONS = [
  {
    id: 1,
    title: "قصة كلاسيكية + تحديد لحية",
    subtitle: "تحويل كامل بأسلوب السبعينات",
    beforeUrl:
      "https://images.unsplash.com/photo-1622286346003-c4b1be0b8a73?q=80&w=1200&auto=format&fit=crop",
    afterUrl:
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "Fade + تصفيف عصري",
    subtitle: "قص مودرن بتدرج مثالي",
    beforeUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200&auto=format&fit=crop",
    afterUrl:
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: 3,
    title: "علاج بشرة + تنعيم لحية",
    subtitle: "بشرة صافية ولحية ناعمة كالحرير",
    beforeUrl:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=1200&auto=format&fit=crop",
    afterUrl:
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=1200&auto=format&fit=crop",
  },
];

export default function BeforeAfterSection({
  eyebrow = "تحولات حقيقية",
  title = "شاهد الفرق بنفسك",
  subtitle = "اسحب السلايدر للمقارنة بين قبل وبعد — نتائج حقيقية من صالوننا",
  transformations = DEFAULT_TRANSFORMATIONS,
}) {
  return (
    <section className="py-20 px-6 relative overflow-hidden" id="transformations">
      {/* Background blob */}
      <div
        className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full blur-[120px] -mr-64 -translate-y-1/2 opacity-15"
        style={{ backgroundColor: "#D4AF37" }}
      />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30">
            <Camera size={14} className="text-[#D4AF37]" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37]">
              {eyebrow}
            </p>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            {title}
          </h2>
          <p className="text-base md:text-lg font-bold text-slate-400 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Transformations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {transformations.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.7,
                delay: index * 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group space-y-5"
            >
              <BeforeAfter
                beforeUrl={item.beforeUrl}
                afterUrl={item.afterUrl}
                beforeAlt="قبل"
                afterAlt="بعد"
                className="group-hover:shadow-[0_40px_100px_rgba(212,175,55,0.25)] transition-shadow duration-700"
              />
              <div className="text-center space-y-1 px-2">
                <h3 className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-2">
                  <Sparkles size={16} className="text-[#D4AF37]" />
                  {item.title}
                </h3>
                <p className="text-xs font-bold text-slate-500">{item.subtitle}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
