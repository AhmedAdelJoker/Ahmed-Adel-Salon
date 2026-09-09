export const DEFAULT_LANDING_STATS = [
  {
    value: "15k+",
    label: "عميل سعيد",
    description: "قاعدة عملاء تثق في التجربة والجودة.",
  },
  {
    value: "20+",
    label: "خبير حلاقة",
    description: "فريق جاهز لتقديم ستايل يناسبك بدقة.",
  },
  {
    value: "4.9/5",
    label: "تقييم العملاء",
    description: "انطباع ممتاز وتجربة تتكرر بثقة.",
  },
];

export const DEFAULT_LANDING_FEATURES = [
  {
    title: "فريق محترف",
    description:
      "نخبة من الحلاقين المهرة ذوي الخبرة الطويلة في أحدث صيحات القص والعناية.",
  },
  {
    title: "جودة ممتازة",
    description:
      "نستخدم أفضل منتجات العناية بالشعر والبشرة العالمية لضمان أفضل النتائج.",
  },
  {
    title: "سهولة الحجز",
    description:
      "نظام حجز إلكتروني متطور يسمح لك باختيار موعدك المفضل وحلاقك الخاص بضغطة زر.",
  },
];

export const DEFAULT_TRUST_BADGES = [
  "خدمة آمنة",
  "5 نجوم",
  "تجربة عائلية",
];

export const DEFAULT_LANDING_TESTIMONIALS = [
  {
    name: "أحمد",
    role: "عميل دائم",
    quote: "التجربة مرتبة جدًا والحجز سهل، والنتيجة كل مرة أفضل من اللي قبلها.",
  },
  {
    name: "كريم",
    role: "زيارة أسبوعية",
    quote: "أكثر شيء يعجبني هو الاهتمام بالتفاصيل والنظافة والالتزام بالموعد.",
  },
  {
    name: "محمود",
    role: "عميل جديد",
    quote: "أول زيارة وكانت ممتازة، الاستقبال محترم واللوك النهائي فعلاً فرق معي.",
  },
];

export const DEFAULT_LANDING_COPY = {
  landingHeroBadge: "",
  landingServicesEyebrow: "خدماتنا",
  landingServicesTitle: "ماذا نقدم لك؟",
  landingServicesSubtitle:
    "مجموعة متكاملة من الخدمات المصممة لتلبية احتياجاتك الرجالية بأعلى المعايير.",
  landingPortfolioEyebrow: "معرض الأعمال",
  landingPortfolioTitle: "إبداعاتنا",
  landingBookingEyebrow: "الحجز",
  landingBookingTitle: "احجز من نفس الصفحة",
  landingBookingSubtitle:
    "اختر الخدمة، الحلاق، الموعد، ثم أكمل بياناتك بدون الانتقال إلى صفحة منفصلة.",
  landingLocationEyebrow: "موقعنا",
  landingLocationTitle: "تجدنا هنا",
  landingLocationDescription:
    "نحن ننتظرك في موقعنا الرئيسي. صالون مجهز بأعلى مستويات الراحة والرفاهية لضمان تجربة لا تُنسى.",
  landingLocationOpenLabel: "متاحون الآن",
  landingLocationClosedLabel: "مغلق حالياً",
  landingLocationStatusText: "تفضل بزيارتنا",
  landingContactEyebrow: "اتصل بنا",
  landingContactTitle: "يسعدنا سماع صوتك",
  landingContactSubtitle:
    "لديك استفسار أو ترغب في تقديم ملاحظة؟ فريقنا جاهز للرد عليك في أي وقت.",
  landingQuickActionsEyebrow: "الإجراءات السريعة",
  landingQuickActionsTitle: "اختر أسرع طريقة للوصول إلينا",
  landingQuickActionsSubtitle:
    "بدلاً من نموذج تواصل تقليدي، وفرنا لك أزرارًا مباشرة للحجز الفوري أو التواصل أو الوصول للموقع.",
  landingFinalTitle: "جاهز لتجربة حلاقة لا تُنسى؟",
  landingFinalSubtitle:
    "انضم إلى آلاف العملاء الراضين واحجز موعدك اليوم لتكتشف الفرق بنفسك.",
  landingFinalButtonLabel: "احجز موعدك الآن",
  landingHeroHighlightTitle: "خدمة استثنائية",
  landingHeroHighlightSubtitle: "نحن نهتم بأدق التفاصيل",
  landingHeroHighlightBadge: "حجز سريع",
  landingHeroVideoUrl: "",
  landingHeroImageAlt: "",
  landingPublicHeaderBadge: "الصفحة العامة",
  landingThemeId: "gold",
  landingShowStaff: true,
  landingShowStaffBio: true,
  landingTestimonialsEyebrow: "آراء العملاء",
  landingTestimonialsTitle: "ماذا يقول عملاؤنا",
  landingTestimonialsSubtitle:
    "انطباعات حقيقية تعكس جودة التجربة داخل المحل من الحجز حتى النتيجة النهائية.",
};

function normalizeList<T, D>(
  values: unknown,
  defaults: D[],
  mapper: (item: Record<string, unknown>, fallback: D, index: number) => T,
): T[] {
  return defaults.map((defaultItem, index) => {
    const current = Array.isArray(values) ? values[index] || {} : {};
    return mapper(current, defaultItem, index);
  });
}

export function buildLandingSiteContent(settings: Record<string, unknown> = {}) {
  const stats = normalizeList(
    settings.landingStats,
    DEFAULT_LANDING_STATS,
    (item, fallback) => ({
      value: item?.value || fallback.value,
      label: item?.label || fallback.label,
      description: item?.description || fallback.description,
    }),
  );

  const features = normalizeList(
    settings.landingFeatures,
    DEFAULT_LANDING_FEATURES,
    (item, fallback) => ({
      title: item?.title || fallback.title,
      description: item?.description || fallback.description,
    }),
  );

  const trustBadges = normalizeList(
    settings.landingTrustBadges,
    DEFAULT_TRUST_BADGES.map((label) => ({ label })),
    (item, fallback) => item?.label || fallback.label,
  );

  const testimonials = normalizeList(
    settings.landingTestimonials,
    DEFAULT_LANDING_TESTIMONIALS,
    (item, fallback) => ({
      name: item?.name || fallback.name,
      role: item?.role || fallback.role,
      quote: item?.quote || fallback.quote,
    }),
  );

  const copy = Object.keys(DEFAULT_LANDING_COPY).reduce<Record<string, string>>((acc, key) => {
    acc[key] = String(settings?.[key] || DEFAULT_LANDING_COPY[key as keyof typeof DEFAULT_LANDING_COPY] || "");
    return acc;
  }, {});

  return { stats, features, trustBadges, testimonials, copy };
}
