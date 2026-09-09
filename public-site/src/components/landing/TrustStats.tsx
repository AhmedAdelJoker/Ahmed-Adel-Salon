import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "./constants";

export default function TrustStats({ landingContent, theme }) {
  return (
    <section className="max-w-6xl mx-auto px-6 -mt-20 relative z-20">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="public-glass-card grid grid-cols-1 md:grid-cols-3 gap-6 rounded-[2.5rem] p-8 md:p-12 border shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
        style={{ borderColor: `${theme.primary}15` }}
      >
        {landingContent.stats.map((stat, index) => (
          <motion.div
            key={index}
            variants={fadeInUp}
            className="flex flex-col items-center text-center space-y-3 p-4 md:border-l last:border-l-0"
            style={{ borderColor: `${theme.primary}15` }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-4xl md:text-5xl font-black tracking-tight"
                style={{ color: theme.primary }}
              >
                {stat.value}
              </span>
              <span
                className="h-2 w-2 rounded-full animate-ping"
                style={{ backgroundColor: theme.primary }}
              />
            </div>
            <h3
              className="text-lg font-black tracking-wide"
              style={{ color: theme.dark }}
            >
              {stat.label}
            </h3>
            <p
              className="text-xs font-bold opacity-60 max-w-xs leading-relaxed"
              style={{ color: theme.text }}
            >
              {stat.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
