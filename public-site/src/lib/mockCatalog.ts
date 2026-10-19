/**
 * mockCatalog.ts — realistic sample data for reviewing the design locally.
 *
 * The public API answers `الموقع العام غير منشور بعد` until a salon is
 * published, which means the landing page renders every empty state and the
 * redesign cannot actually be looked at: the editorial services list, the team
 * grid, the gallery and the testimonials are all invisible.
 *
 * Gating:
 *   - `import.meta.env.DEV` — this module is only imported from a `DEV`
 *     guarded branch, and Vite tree-shakes the reference out of the production
 *     bundle entirely.
 *   - `?demo=1` — an explicit opt-in, so a developer's normal `npm run dev`
 *     still shows real data.
 *
 * It is sample content, never shown to a visitor of a deployed site.
 */

export const DEMO_FLAG = "demo";

export interface MockService {
  [key: string]: unknown;
  id: number;
  name_ar: string;
  name: string;
  description_ar: string;
  description: string;
  price: number;
  duration_minutes: number;
  category_id: number;
  is_featured?: boolean;
  image_url?: string;
}

export interface MockBarber {
  [key: string]: unknown;
  id: number;
  display_name: string;
  job_title: string;
  bio_ar: string;
  profile_image_url?: string;
}

export interface MockOffer {
  [key: string]: unknown;
  id: number;
  name_ar: string;
  description_ar: string;
  offer_price: number;
  price: number;
  discount_percentage: number;
  /**
   * Services this offer covers. Mirrors the field `booking-catalog` now sends
   * per offer (`Offer.offer_services` in the database), and is what lets
   * `?offer=<id>` preselect anything in the booking flow. An offer without it is
   * a discount on nothing, which is why the field is required here rather than
   * optional.
   */
  service_ids: number[];
}

const SERVICES: MockService[] = [
  {
    id: 1,
    name_ar: "قص كلاسيك",
    name: "Classic Cut",
    description_ar: "قص دقيق مع تشطيب الرقبة والحواف، وخط لامع أمامي.",
    description: "A precise cut with neck and edge cleanup.",
    price: 250,
    duration_minutes: 30,
    category_id: 1,
    is_featured: true,
  },
  {
    id: 2,
    name_ar: "قص وتلوين",
    name: "Cut & Colour",
    description_ar: "قص كامل مع تغطية بيضاء أو رمادية مناسبة لشعر طبيعي.",
    description: "Full cut with a subtle grey or white blend.",
    price: 450,
    duration_minutes: 60,
    category_id: 1,
  },
  {
    id: 3,
    name_ar: "حلاقة ذقن",
    name: "Beard Trim",
    description_ar: "تشذيب الذقن وتوحيد الشكل مع الفوكة والعناية بالبشرة.",
    description: "Shape-up, line-up and skin finish.",
    price: 150,
    duration_minutes: 20,
    category_id: 2,
  },
  {
    id: 4,
    name_ar: "جلسة عناية",
    name: "Care Session",
    description_ar: "ماسك وسيروم وبخار لشعر وبشرة أكثر صحة.",
    description: "Mask, serum and steam therapy for scalp and skin.",
    price: 300,
    duration_minutes: 40,
    category_id: 2,
  },
  {
    id: 5,
    name_ar: "قص أطفال",
    name: "Kids Cut",
    description_ar: "قص لطيف للأطفال مع صبر وتسلية أثناء الانتظار.",
    description: "A patient cut for children.",
    price: 180,
    duration_minutes: 25,
    category_id: 3,
  },
  {
    id: 6,
    name_ar: "باقة groom كاملة",
    name: "Full Groom Package",
    description_ar: "قص كامل مع العناية بالمنتجات وضيافة للضيوف.",
    description: "Full cut with care, products and refreshments.",
    price: 700,
    duration_minutes: 90,
    category_id: 3,
    is_featured: true,
  },
];

const CATEGORIES = [
  { id: 1, name_ar: "قص وتلوين" },
  { id: 2, name_ar: "العناية" },
  { id: 3, name_ar: "باقات" },
];

const BARBERS: MockBarber[] = [
  {
    id: 1,
    display_name: "أحمد كامل",
    job_title: "حلاق رئيسي",
    bio_ar: "أحد عشر عامًا في الصالون، متخصص في القص الدقيق والتلوين الطبيعي.",
  },
  {
    id: 2,
    display_name: "كريم عبد الله",
    job_title: "خبير عناية",
    bio_ar: "يعمل على صحة الشعر والجلد، ويبني خطة عناية لكل عميل.",
  },
  {
    id: 3,
    display_name: "محمود فؤاد",
    job_title: "حلاق",
    bio_ar: "متخصص في قص الأطفال وباقات المناسبات.",
  },
];

const OFFERS: MockOffer[] = [
  {
    id: 1,
    name_ar: "عرض الافتتاح",
    description_ar: "خصم على أول زيارة مع قص كلاسيك.",
    offer_price: 200,
    price: 250,
    discount_percentage: 20,
    service_ids: [1],
  },
  {
    id: 2,
    name_ar: "باقة الأب وابن",
    description_ar: "قصّان للبالغ والطفل مع خصم 15%.",
    offer_price: 600,
    price: 700,
    discount_percentage: 15,
    service_ids: [1, 2],
  },
];

/** Owner-style settings, so the configurable sections have content too. */
const BUSINESS: Record<string, unknown> = {
  salon_name: "صالون الحرفة",
  currency: "ج.م",
  shop_phone: "+20 100 123 4567",
  shop_whatsapp: "+20 100 123 4567",
  address: "15 شارع النيل، وسط البلد، القاهرة",
  logo_url: "",
  landing_theme_id: "midnight",
  workingHours: {
    saturday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    sunday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    monday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    tuesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    wednesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
    thursday: { is_open: true, open_time: "10:00", close_time: "23:00" },
    friday: { is_open: true, open_time: "13:00", close_time: "23:00" },
  },
};

/** Settings shaped for `buildLandingSiteContent`, so those sections render. */
const OWNER_CONTENT: Record<string, unknown> = {
  landingHeroBadge: "",
  landingHeroTitle: "الحلاقة مهنة، والحرفة أولوية",
  landingHeroSubtitle:
    "خدمة على المقاس، وحافظ على شكل خط الشعر — من غير كلام كتير.",
  landingServicesEyebrow: "القائمة",
  landingServicesTitle: "كل خدمة بسعرها",
  landingServicesSubtitle:
    "أسعار واضحة قبل ما تقعد، وومدة كل خدمة قدامك من غير مفاجآت.",
  landingTestimonialsEyebrow: "آراء",
  landingTestimonialsTitle: "اللي بيرجعوا تاني",
  landingLocationEyebrow: "المكان",
  landingLocationTitle: "نقطة وسط البلد",
  landingContactEyebrow: "التواصل",
  landingContactTitle: "زورنا في وسط البلد",
  landingFinalTitle: "جاهز لتجربة تانية؟",
  landingFinalSubtitle: "احجز دلوقتي، والموعد يتأكد في أقل من دقيقة.",
  landingStats: [
    { value: "12+", label: "سنة خبرة" },
    { value: "4.9", label: "تقييم العملاء" },
    { value: "3", label: "حلاق في الفريق" },
    { value: "6", label: "خدمات" },
  ],
  landingTrustBadges: [{ label: "مواعيد مؤكدة" }, { label: "منتجات أصلية" }],
  landingFeatures: [
    {
      title: "موعد مضمون",
      description: "مفيش ازدحام، وكل موعد ليه وقت مخصص."
    },
    {
      title: "أدوات معقمة",
      description: "تعقيم كامل بعد كل عميل، وأدوات تُفتح أمامك."
    },
    {
      title: "استشارة مجانية",
      description: "نقولك إيه يناسب شكل خط الشعر بتاعك."
    },
  ],
  landingTestimonials: [
    { name: "محمود ع.", role: "عميل دائم", quote: "أول مرة أحس إن القص بيطلع من غير ما أقوله 10 مرات." },
    { name: "كريم ش.", role: "زائر جديد", quote: "السعر واضح من أول، والموعد اتأكد في ثانية." },
    { name: "يوسف ر.", role: "عميل أسبوعي", quote: "المكان نضيف والفريق بيعرف شغله. رايح كل أسبوع." },
  ],
  landingPortfolio: [],

  /*
   * The five settings that had inputs in `WebsiteSettingsPanel` and were never
   * rendered. They are populated here so `?demo=1` actually exercises them —
   * a demo that leaves them empty cannot show whether the wiring works.
   */
  landingPublicHeaderBadge: "الصفحة العامة",
  landingHeroHighlightBadge: "حجز سريع",
  landingHeroHighlightTitle: "خدمة استثنائية",
  landingHeroHighlightSubtitle: "نهتم بأدق التفاصيل، من أول نظرة على شكل خط الشعر لحد ما تطلع من الكرسي.",
  landingAboutEyebrow: "عن الصالون",
  landingAboutTitle: "صالون بيشتغل بمبدأ واحد",
  landingAboutContent:
    "من غير زحمة ولا استقبال مبالغ فيه.\nنسمع، نقترح، ونشتغل على اللي اتفقنا عليه.\nولو النتيجة مش زي ما اتوقعت، عدّلها من غير ما تدفع زيادة.",
};

/**
 * The sample catalogue, gated at module scope.
 *
 * This indirection is load-bearing. An earlier version exported the arrays
 * individually and checked `import.meta.env.DEV` inside a helper, which made
 * the demo flag a *runtime* value threaded through `useMemo` and `useState` —
 * and Rollup cannot constant-fold that, so the entire sample catalogue shipped
 * inside the production bundle. One ternary at module scope collapses to
 * `false` at build time, which makes every reference below it unreachable and
 * lets the bundler drop the literals.
 *
 * `contracts.test.mjs` asserts the sample strings are absent from `dist/`, so a
 * regression here fails the build rather than quietly shipping.
 */
export const DEMO = import.meta.env.DEV
  ? {
      services: SERVICES,
      categories: CATEGORIES,
      barbers: BARBERS,
      offers: OFFERS,
      business: BUSINESS,
      owner: OWNER_CONTENT,
    }
  : null;

/** True only in a dev build with `?demo=1`. */
export function isDemoRequested(search: string): boolean {
  return DEMO !== null && new URLSearchParams(search).get(DEMO_FLAG) === "1";
}

