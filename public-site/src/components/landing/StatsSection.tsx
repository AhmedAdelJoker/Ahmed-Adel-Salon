import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "./animations";

/**
 * StatsSection — Trust stats ribbon (3-up grid).
 * Polished with the new display typography + surface-glass pattern.
 */
export interface StatItem {
  value?: string | number;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface LandingTheme {
  primary?: string;
  dark?: string;
  text?: string;
  [key: string]: string | undefined;
}

export default function StatsSection({ stats = [], theme = {} }: { stats?: StatItem[]; theme?: LandingTheme }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative z-20">
      <motion.div
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="surface-glass grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.06)]"
        style={{ borderColor: `${theme.primary}15` }}
      >
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            variants={fadeInUp}
            className="flex flex-col items-center text-center space-y-2.5 p-3 sm:p-4 md:border-l last:border-l-0"
            style={{ borderColor: `${theme.primary}15` }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight tabular-nums"
                style={{ color: theme.primary, fontFamily: "var(--font-display)" }}
              >
                {stat.value}
              </span>
              <span
                className="h-2 w-2 rounded-full animate-ping shrink-0"
                style={{ backgroundColor: theme.primary }}
              />
            </div>
            <h3
              className="text-base sm:text-lg font-black tracking-wide"
              style={{ color: theme.dark, fontFamily: "var(--font-display)" }}
            >
              {stat.label}
            </h3>
            <p
              className="text-xs sm:text-sm font-medium opacity-60 max-w-xs leading-relaxed"
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
