import { motion } from "framer-motion";
import { Award, Sparkles, Clock3 } from "lucide-react";
import { cardMotion, staggerContainer } from "./animations";

const FEATURE_ICONS = [Award, Sparkles, Clock3];

export interface FeatureItem {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

export interface LandingTheme {
  primary?: string;
  dark?: string;
  text?: string;
  card?: string;
  muted?: string;
  [key: string]: string | undefined;
}

export interface FeaturesSectionProps {
  features?: FeatureItem[];
  theme?: LandingTheme;
}

export default function FeaturesSection({ features = [], theme = {} }: FeaturesSectionProps) {
  return (
    <section className="section-rhythm px-4 sm:px-6 relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full blur-[120px] -ml-64 -translate-y-1/2 opacity-20 pointer-events-none"
        style={{ backgroundColor: `${theme.primary}10` }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center space-y-4 mb-12 sm:mb-16">
          <p
            className="text-eyebrow-ar"
            style={{ color: theme.primary }}
          >
            لماذا يختارنا صفوة الرجال
          </p>
          <h2
            className="text-display-md text-white"
            style={{ color: theme.dark }}
          >
            تجربة تفوق التوقعات
          </h2>
          <div
            className="h-1.5 w-16 mx-auto rounded-full"
            style={{ backgroundColor: theme.primary }}
          />
        </div>

        {/* Features grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
        >
          {features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
            return (
              <motion.div
                key={index}
                variants={cardMotion}
                whileHover="hover"
                className="group relative p-7 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border flex flex-col items-center text-center space-y-5 transition-all duration-500 shadow-lg hover:shadow-2xl"
                style={{
                  backgroundColor: theme.card,
                  borderColor: `${theme.primary}15`,
                }}
              >
                {/* Hover gradient overlay */}
                <div
                  className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${theme.primary}15 0%, transparent 60%)`,
                  }}
                />

                <div
                  className="relative h-16 w-16 rounded-[1.3rem] flex items-center justify-center shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                  style={{ backgroundColor: theme.dark, color: theme.primary }}
                >
                  <Icon size={26} strokeWidth={2.2} />
                </div>

                <h3
                  className="text-xl font-black tracking-tight"
                  style={{ color: theme.dark, fontFamily: "var(--font-display)" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm font-medium leading-relaxed opacity-75"
                  style={{ color: theme.muted }}
                >
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
