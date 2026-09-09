import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, HelpCircle } from "lucide-react";

/**
 * FAQSection — Accordion FAQ with smooth animations.
 * Uses the new display typography + surface-glass pattern.
 */
const DEFAULT_FAQS = [
  {
    q: "هل يمكنني الحجز أونلاين؟",
    a: "بالتأكيد! نظام الحجز الإلكتروني لدينا متاح 24/7. اختر خدمتك المفضلة، الحلاق، والموعد المناسب، وستصلك رسالة تأكيد فوراً.",
  },
  {
    q: "ما هي طرق الدفع المتاحة؟",
    a: "نقبل جميع بطاقات الائتمان الرئيسية (Visa, Mastercard)، الدفع نقداً، Apple Pay، وخدمات المحافظ الإلكترونية مثل فودافون كاش.",
  },
  {
    q: "هل تقدمون خدمات في المنزل؟",
    a: "نعم، نوفر خدمة الحلاقة المنزلية في نطاق القاهرة الكبرى برسوم إضافية بسيطة للحجز المنزلي.",
  },
  {
    q: "كم تستغرق جلسة الحلاقة الكاملة؟",
    a: "تختلف حسب الخدمات المختارة. الحلاقة الأساسية 30 دقيقة، الباقة الملكية الكاملة 75-90 دقيقة.",
  },
  {
    q: "هل منتجاتكم مناسبة للبشرة الحساسة؟",
    a: "نستخدم فقط منتجات عالمية معتمدة (L'Oréal, Schwarzkopf, Kérastase) ونوفر بدائل للبشرة الحساسة. أخبرنا بأي حساسية وسنخصص لك المنتجات المناسبة.",
  },
  {
    q: "ما هي سياسة الإلغاء؟",
    a: "يمكنك إلغاء أو تعديل موعدك مجاناً حتى 4 ساعات قبل الموعد المحدد. بعد ذلك يتم احتساب 50% من قيمة الخدمة.",
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export interface LandingTheme {
  primary?: string;
  dark?: string;
  text?: string;
  card?: string;
  muted?: string;
  [key: string]: string | undefined;
}

export interface FAQSectionProps {
  faqs?: FaqItem[];
  theme?: LandingTheme;
}

export default function FAQSection({ faqs = DEFAULT_FAQS, theme = {} }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section-rhythm px-4 sm:px-6 relative" id="faq">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-10 sm:mb-12">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border"
            style={{
              backgroundColor: `${theme.primary}10`,
              borderColor: `${theme.primary}30`,
            }}
          >
            <HelpCircle size={14} style={{ color: theme.primary }} />
            <p
              className="text-eyebrow-ar"
              style={{ color: theme.primary }}
            >
              الأسئلة الشائعة
            </p>
          </div>
          <h2
            className="text-display-md"
            style={{ color: theme.dark, fontFamily: "var(--font-display)" }}
          >
            إجابات على كل أسئلتك
          </h2>
          <div
            className="h-1.5 w-16 mx-auto rounded-full"
            style={{ backgroundColor: theme.primary }}
          />
        </div>

        {/* Accordion */}
        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="rounded-2xl border overflow-hidden transition-colors"
                style={{
                  backgroundColor: theme.card,
                  borderColor: isOpen
                    ? `${theme.primary}40`
                    : `${theme.primary}10`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${index}`}
                  className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-right hover:bg-white/[0.02] transition-colors"
                >
                  <span
                    className="text-base sm:text-lg font-black tracking-tight"
                    style={{ color: theme.text, fontFamily: "var(--font-display)" }}
                  >
                    {faq.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: isOpen
                        ? theme.primary
                        : `${theme.primary}15`,
                      color: isOpen ? "#09090B" : theme.primary,
                    }}
                  >
                    <Plus size={18} strokeWidth={2.5} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${index}`}
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm sm:text-base font-medium leading-relaxed"
                        style={{ color: theme.muted }}
                      >
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
