import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Facebook,
  Instagram,
  MapPin,
  Menu,
  MessageCircle,
  Music2,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
  Youtube,
} from "lucide-react";
import api from "../services/api";
import { buildPublicBookingPath } from "../lib/publicSite";
import { buildLandingSiteContent } from "../lib/publicSiteContent";
import { readPublicSitePreviewDraft } from "../lib/publicSitePreview";
import {
  buildBreadcrumbSchema,
  buildFAQSchema,
  buildHairSalonSchema,
  useSEO,
} from "../hooks/useSEO";
import { buildSizes, buildSrcSet } from "../lib/imageOptimizer";
import { Button } from "../components/ui/button";
import LanguageSwitcher from "../components/landing/LanguageSwitcher";
import CurrencySwitcher from "../components/landing/CurrencySwitcher";
import MemberPortal from "../components/landing/MemberPortal";
import ThemeToggle from "../components/landing/ThemeToggle";

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : "http://localhost:8000";

const FALLBACK_HERO =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1800&auto=format&fit=crop";
const FALLBACK_SERVICE =
  "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?q=80&w=900&auto=format&fit=crop";

const themes = {
  midnight: {
    bg: "#09090B",
    surface: "#111114",
    card: "#17171A",
    border: "rgba(255,255,255,0.1)",
    text: "#F8FAFC",
    muted: "#A1A1AA",
    accent: "#D4AF37",
    accent2: "#E5C366",
  },
  gold: {
    bg: "#FAFAF7",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    border: "rgba(26,21,16,0.1)",
    text: "#1A1510",
    muted: "#6B5D4B",
    accent: "#B08D26",
    accent2: "#D4AF37",
  },
  silver: {
    bg: "#F1F5F9",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    border: "rgba(15,23,42,0.1)",
    text: "#0F172A",
    muted: "#64748B",
    accent: "#475569",
    accent2: "#94A3B8",
  },
};

const defaultHours = {
  sunday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  monday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  tuesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  wednesday: { is_open: true, open_time: "10:00", close_time: "22:00" },
  thursday: { is_open: true, open_time: "10:00", close_time: "23:00" },
  friday: { is_open: true, open_time: "13:00", close_time: "23:00" },
  saturday: { is_open: true, open_time: "10:00", close_time: "22:00" },
};

const dayNames = {
  sunday: "الأحد",
  monday: "الإثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
  saturday: "السبت",
};

const fallbackTestimonials = [
  {
    name: "أحمد كمال",
    role: "عميل دائم",
    quote: "تجربة مرتبة من أول الحجز لحد الخروج. الخدمة واضحة والمواعيد دقيقة.",
  },
  {
    name: "محمد السيد",
    role: "عميل مميز",
    quote: "أفضل ما في المكان أن كل التفاصيل واضحة، والأسعار والخدمات ظاهرة قبل الحجز.",
  },
  {
    name: "عمر فاروق",
    role: "زائر جديد",
    quote: "التصميم الجديد للموقع ساعدني أختار الخدمة والموعد بسرعة ومن غير تشتت.",
  },
];

function resolveAssetUrl(value) {
  if (!value) return null;
  return String(value).startsWith("http") ? value : `${STATIC_URL}${value}`;
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function SectionHeading({ eyebrow, title, subtitle, theme }) {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-12">
      <p
        className="mb-3 text-[11px] font-black uppercase tracking-[0.16em]"
        style={{ color: theme.accent }}
      >
        {eyebrow}
      </p>
      <h2
        className="text-2xl font-black leading-tight tracking-normal sm:text-4xl"
        style={{ color: theme.text }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-8 sm:text-base"
          style={{ color: theme.muted }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, theme }) {
  return (
    <div
      className="min-w-0 rounded-3xl border p-5 shadow-sm"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${theme.accent}22`, color: theme.accent }}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-black leading-none" style={{ color: theme.text }}>
        {value}
      </div>
      <p className="mt-2 text-xs font-bold leading-6" style={{ color: theme.muted }}>
        {label}
      </p>
    </div>
  );
}

function ServiceCard({ service, currency, theme, onBook }) {
  const image = resolveAssetUrl(service.image_url) || FALLBACK_SERVICE;
  const duration = service.duration_minutes || service.duration;

  return (
    <article
      className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={image}
          srcSet={buildSrcSet(image, [360, 540, 720, 900]) || undefined}
          sizes={buildSizes("(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw")}
          alt={service.name_ar || service.name || "خدمة صالون"}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex flex-wrap items-center gap-2">
            {duration ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-white/12 px-3 py-1 text-[11px] font-black text-white backdrop-blur">
                <Clock3 size={12} /> {duration} دقيقة
              </span>
            ) : null}
            {service.is_featured ? (
              <span className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-black" style={{ backgroundColor: theme.accent, color: "#09090B" }}>
                <Sparkles size={12} /> مميز
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-black leading-7" style={{ color: theme.text }}>
          {service.name_ar || service.name || "خدمة احترافية"}
        </h3>
        <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm font-bold leading-7" style={{ color: theme.muted }}>
          {service.description_ar || service.description || "خدمة مصممة بعناية لتجربة واضحة وسريعة داخل الصالون."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-2xl font-black" style={{ color: theme.accent }}>
              {Number(service.price || 0).toLocaleString("ar-EG")}
            </span>
            <span className="ms-1 text-xs font-black" style={{ color: theme.muted }}>
              {currency}
            </span>
          </div>
          <Button
            onClick={() => onBook(service)}
            className="min-h-11 rounded-2xl px-5 text-xs"
            style={{ backgroundColor: theme.accent, color: "#09090B" }}
          >
            احجز الخدمة
          </Button>
        </div>
      </div>
    </article>
  );
}

function TeamCard({ barber, theme }) {
  const image =
    resolveAssetUrl(barber.profile_image_url) ||
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=700&auto=format&fit=crop";

  return (
    <article
      className="min-w-0 overflow-hidden rounded-3xl border"
      style={{ backgroundColor: theme.card, borderColor: theme.border }}
    >
      <div className="aspect-[4/5] overflow-hidden">
        <img
          src={image}
          srcSet={buildSrcSet(image, [360, 540, 720]) || undefined}
          sizes={buildSizes("(max-width: 640px) 100vw, 33vw")}
          alt={barber.display_name || "خبير صالون"}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-5">
        <h3 className="text-lg font-black" style={{ color: theme.text }}>
          {barber.display_name || "خبير صالون"}
        </h3>
        <p className="mt-1 text-xs font-black" style={{ color: theme.accent }}>
          {barber.job_title || "خبير حلاقة وعناية"}
        </p>
        {(barber.bio_ar || barber.bio_en || barber.bio) && (
          <p className="mt-3 line-clamp-3 text-sm font-bold leading-7" style={{ color: theme.muted }}>
            {barber.bio_ar || barber.bio_en || barber.bio}
          </p>
        )}
      </div>
    </article>
  );
}

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicSlug } = useParams();

  interface LandingSettings {
    salonName?: string;
    salon_name?: string;
    landingThemeId?: string;
    landing_theme_id?: string;
    currency?: string;
    logoUrl?: string;
    logo_url?: string;
    landingCoverImageUrl?: string;
    landing_cover_image_url?: string;
    landingHeroImageAlt?: string;
    landing_hero_image_alt?: string;
    workingHours?: Record<string, { is_open?: boolean; open_time?: string; close_time?: string }>;
    working_hours?: Record<string, { is_open?: boolean; open_time?: string; close_time?: string }>;
    landingTestimonials?: { quote?: string; quote_ar?: string; name?: string; name_ar?: string; role?: string; role_ar?: string }[];
    landingHeroTitle?: string;
    landingHeroSubtitle?: string;
    shopPhone?: string;
    shop_phone?: string;
    shopWhatsApp?: string;
    shop_whatsapp?: string;
    googleMapsUrl?: string;
    google_maps_url?: string;
    address?: string;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
    socialFacebook?: string;
    socialInstagram?: string;
    socialTiktok?: string;
    socialYoutube?: string;
    [key: string]: unknown;
  }

  interface LandingService {
    id?: string | number;
    name?: string;
    name_ar?: string;
    price?: number | string;
    description?: string;
    description_ar?: string;
    [key: string]: unknown;
  }

  interface LandingOffer {
    id?: string | number;
    name?: string;
    name_ar?: string;
    description?: string;
    description_ar?: string;
    offer_price?: number | string;
    price?: number | string;
    discount_percentage?: number | string;
    [key: string]: unknown;
  }

  interface LandingBarber {
    id?: string | number;
    address?: string;
    display_name?: string;
    full_name?: string;
    profile_image_url?: string;
    job_title?: string;
    [key: string]: unknown;
  }

  const [settings, setSettings] = useState<LandingSettings | null>(null);
  const [services, setServices] = useState<LandingService[]>([]);
  const [offers, setOffers] = useState<LandingOffer[]>([]);
  const [barbers, setBarbers] = useState<LandingBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const livePreviewEnabled = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("livePreview") === "1";
  }, [location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const catalogRes = await api.get("/public/booking-catalog");
        const catalogData = catalogRes.data || catalogRes;
        const preview = livePreviewEnabled ? readPublicSitePreviewDraft() : null;
        if (!mounted) return;
        setSettings({ ...(catalogData?.business || {}), ...(preview || {}) });
        setServices(Array.isArray(catalogData?.services) ? catalogData.services : []);
        setOffers(Array.isArray(catalogData?.offers) ? catalogData.offers : []);
        setBarbers(Array.isArray(catalogData?.barbers) ? catalogData.barbers : []);
      } catch (error) {
        console.error("Failed to fetch landing data", error);
        if (mounted) setSettings({});
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => {
      mounted = false;
    };
  }, [livePreviewEnabled]);

  const salonName = settings?.salonName || settings?.salon_name || "Salon Pro";
  const theme = themes[settings?.landingThemeId ?? settings?.landing_theme_id ?? ""] || themes.midnight;
  const landingContent = buildLandingSiteContent(settings || {});
  const bookingPath = settings ? buildPublicBookingPath(settings) : "/book";
  const currency = settings?.currency || "ج.م";
  const logoImage = resolveAssetUrl(settings?.logoUrl || settings?.logo_url);
  const coverImage = resolveAssetUrl(settings?.landingCoverImageUrl || settings?.landing_cover_image_url);
  const heroImage = coverImage || FALLBACK_HERO;
  const heroImageAlt =
    settings?.landingHeroImageAlt ||
    settings?.landing_hero_image_alt ||
    `صورة رئيسية من ${salonName}`;
  const activeHours = settings?.workingHours || settings?.working_hours || defaultHours;
  const testimonials =
    Array.isArray(settings?.landingTestimonials) && settings.landingTestimonials.length
      ? settings.landingTestimonials
      : fallbackTestimonials;
  const visibleServices = services.slice(0, 6);
  const visibleOffers = offers.slice(0, 3);
  const visibleBarbers = barbers.slice(0, 3);
  const phone = settings?.shopPhone || settings?.shop_phone || "";
  const whatsapp = settings?.shopWhatsApp || settings?.shop_whatsapp || phone;
  const whatsappUrl = normalizePhone(whatsapp)
    ? `https://wa.me/2${normalizePhone(whatsapp)}`
    : null;
  const mapsUrl =
    settings?.googleMapsUrl ||
    settings?.google_maps_url ||
    (settings?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
      : null);

  const isOpenNow = useMemo(() => {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const now = new Date();
    const egypt = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
    const today = activeHours?.[days[egypt.getDay()]];
    if (!today?.is_open || !today.open_time || !today.close_time) return false;
    const minutes = egypt.getHours() * 60 + egypt.getMinutes();
    const [openH, openM] = today.open_time.split(":").map(Number);
    const [closeH, closeM] = today.close_time.split(":").map(Number);
    return minutes >= openH * 60 + openM && minutes <= closeH * 60 + closeM;
  }, [activeHours]);

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/salon/${publicSlug || ""}`
      : "";

  useSEO({
    title: settings?.metaTitle || `${salonName} | احجز موعدك الآن`,
    description:
      settings?.metaDescription ||
      `احجز موعدك في ${salonName} بسهولة. خدمات واضحة وأسعار ظاهرة وتجربة حجز احترافية.`,
    image: heroImage,
    url: pageUrl,
    type: "website",
    siteName: salonName,
    locale: "ar_EG",
    keywords: settings?.metaKeywords || `${salonName}, صالون, حلاقة, حجز أونلاين`,
    preloadImage: heroImage,
    schema: [
      buildHairSalonSchema({
        settings: settings || {},
        salonName,
        heroImage,
        url: pageUrl,
        address: settings?.address,
      }),
      buildBreadcrumbSchema({
        items: [
          { name: "الرئيسية", url: typeof window !== "undefined" ? window.location.origin : "" },
          { name: salonName, url: pageUrl },
        ],
      }),
      buildFAQSchema({
        faqs: [
          { q: "هل يمكنني الحجز أونلاين؟", a: "نعم، يمكنك اختيار الخدمة والموعد من صفحة الحجز مباشرة." },
          { q: "هل الأسعار واضحة قبل الحجز؟", a: "نعم، تظهر أسعار الخدمات ومدتها داخل صفحة الصالون." },
          { q: "كيف أتواصل مع الصالون؟", a: "يمكنك الاتصال أو التواصل عبر واتساب من أزرار الصفحة." },
        ],
      }),
    ],
  });

  const navLinks = [
    { label: "الرئيسية", href: "#home" },
    { label: "الخدمات", href: "#services" },
    visibleOffers.length ? { label: "العروض", href: "#offers" } : null,
    visibleBarbers.length ? { label: "الفريق", href: "#team" } : null,
    { label: "التواصل", href: "#contact" },
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090B] px-4 text-white" dir="rtl">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#D4AF37] text-[#09090B]">
            <Scissors size={30} />
          </div>
          <p className="text-sm font-black">جاري تجهيز صفحة الصالون...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden pb-24"
      style={{ backgroundColor: theme.bg, color: theme.text }}
      dir="rtl"
    >
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? "border-b shadow-2xl" : ""}`}
        style={{
          backgroundColor: scrolled ? `${theme.bg}F2` : `${theme.bg}CC`,
          borderColor: theme.border,
          backdropFilter: "blur(18px)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#home" className="flex min-w-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
              style={{ backgroundColor: theme.card, borderColor: theme.border, color: theme.accent }}
            >
              {logoImage ? <img src={logoImage} alt={salonName} className="h-full w-full object-cover" /> : <Scissors size={22} />}
            </span>
            <span className="min-w-0">
              <span className="block max-w-[10rem] truncate text-base font-black sm:max-w-xs sm:text-lg">
                {salonName}
              </span>
              <span className="block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
                Professional Salon
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-2 text-sm font-black transition hover:bg-white/10"
                style={{ color: theme.muted }}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <LanguageSwitcher />
              <CurrencySwitcher />
              <MemberPortal />
            </div>
            <Button
              onClick={() => navigate(bookingPath)}
              className="hidden min-h-11 rounded-2xl px-5 text-xs sm:inline-flex"
              style={{ backgroundColor: theme.accent, color: "#09090B" }}
            >
              احجز الآن
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border lg:hidden"
              style={{ borderColor: theme.border, color: theme.text }}
              aria-label="فتح القائمة"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t px-4 pb-4 lg:hidden" style={{ borderColor: theme.border }}>
            <div className="mx-auto grid max-w-7xl gap-2 pt-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-2xl px-4 py-3 text-sm font-black"
                  style={{ backgroundColor: theme.card, color: theme.text }}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-4 gap-2 md:hidden">
                <ThemeToggle />
                <LanguageSwitcher />
                <CurrencySwitcher />
                <MemberPortal />
              </div>
              <Button
                onClick={() => {
                  setMenuOpen(false);
                  navigate(bookingPath);
                }}
                className="mt-2 min-h-12 w-full rounded-2xl"
                style={{ backgroundColor: theme.accent, color: "#09090B" }}
              >
                احجز موعدك الآن
              </Button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="pt-20" tabIndex={-1}>
        <section id="home" className="relative">
          <div className="absolute inset-0 h-[46rem] overflow-hidden">
            <img
              src={heroImage}
              srcSet={buildSrcSet(heroImage, [720, 1080, 1440, 1800]) || undefined}
              sizes={buildSizes("100vw")}
              alt={heroImageAlt}
              className="h-full w-full object-cover opacity-45"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/70 to-transparent" />
          </div>

          <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
            <div className="min-w-0">
              <div
                className="mb-5 inline-flex max-w-full items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-black"
                style={{ backgroundColor: "rgba(212,175,55,0.12)", borderColor: "rgba(212,175,55,0.28)", color: theme.accent2 }}
              >
                <Star size={14} fill="currentColor" />
                تقييم 4.9 من 5 وتجربة حجز واضحة
              </div>
              <h1 className="max-w-3xl text-3xl font-black leading-[1.18] tracking-normal text-white min-[390px]:text-4xl sm:text-6xl lg:text-7xl">
                {landingContent.copy.landingHeroTitle || `احجز موعدك في ${salonName} بسهولة`}
              </h1>
              <p className="mt-6 max-w-2xl text-base font-bold leading-9 text-white/76 sm:text-lg">
                {landingContent.copy.landingHeroSubtitle ||
                  "خدمات واضحة، أسعار ظاهرة، وفريق محترف يساعدك تختار الموعد المناسب بدون تشتت."}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={() => navigate(bookingPath)}
                  className="min-h-14 rounded-2xl px-7 text-base"
                  style={{ backgroundColor: theme.accent, color: "#09090B" }}
                >
                  احجز موعدك الآن <ArrowLeft size={18} />
                </Button>
                <a
                  href="#services"
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border px-7 text-base font-black text-white transition hover:bg-white/10"
                  style={{ borderColor: "rgba(255,255,255,0.2)" }}
                >
                  تصفح الخدمات
                </a>
              </div>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatCard label="عميل سعيد يثق في التجربة" value="15k+" icon={Users} theme={theme} />
              <StatCard label="خدمات وفريق جاهز يوميًا" value={`${Math.max(services.length, 20)}+`} icon={Scissors} theme={theme} />
              <StatCard label={isOpenNow ? "الصالون مفتوح الآن" : "راجع ساعات العمل قبل الحجز"} value={isOpenNow ? "مفتوح" : "مغلق"} icon={ShieldCheck} theme={theme} />
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="الخدمات"
            title="خدمات واضحة وأسعار ظاهرة"
            subtitle="اختر الخدمة المناسبة لك بسرعة. كل بطاقة تعرض الاسم، المدة، السعر، وزر الحجز بدون تزاحم."
            theme={theme}
          />
          {visibleServices.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  currency={currency}
                  theme={theme}
                  onBook={() => navigate(bookingPath)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border p-8 text-center" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <p className="font-bold" style={{ color: theme.muted }}>
                لم يتم إضافة خدمات بعد. يمكنك الحجز مباشرة أو التواصل مع الصالون.
              </p>
            </div>
          )}
        </section>

        {visibleOffers.length ? (
          <section id="offers" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="العروض"
              title="عروض مختارة لهذا الأسبوع"
              subtitle="العروض تظهر في كروت بسيطة حتى تكون الأسعار والخصومات واضحة على الموبايل والكمبيوتر."
              theme={theme}
            />
            <div className="grid gap-5 md:grid-cols-3">
              {visibleOffers.map((offer) => (
                <article
                  key={offer.id}
                  className="min-w-0 rounded-3xl border p-6"
                  style={{ backgroundColor: theme.card, borderColor: theme.border }}
                >
                  <span className="inline-flex rounded-xl px-3 py-1 text-[11px] font-black" style={{ backgroundColor: `${theme.accent}22`, color: theme.accent }}>
                    خصم {Math.round(Number(offer.discount_percentage || 0))}%
                  </span>
                  <h3 className="mt-4 text-xl font-black leading-8" style={{ color: theme.text }}>
                    {offer.name_ar || offer.name || "عرض خاص"}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm font-bold leading-7" style={{ color: theme.muted }}>
                    {offer.description_ar || offer.description || "عرض محدود لفترة قصيرة."}
                  </p>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div className="text-2xl font-black" style={{ color: theme.accent }}>
                      {Number(offer.offer_price || offer.price || 0).toLocaleString("ar-EG")} {currency}
                    </div>
                    <Button
                      onClick={() => navigate(bookingPath)}
                      className="min-h-11 rounded-2xl px-5 text-xs"
                      style={{ backgroundColor: theme.accent, color: "#09090B" }}
                    >
                      احجز العرض
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {visibleBarbers.length ? (
          <section id="team" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="الفريق"
              title="خبراء يقدمون تجربة ثابتة"
              subtitle="تعرف على الفريق قبل اختيار موعدك. البطاقات مصممة لتظهر الصور والأسماء بوضوح."
              theme={theme}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBarbers.map((barber) => (
                <TeamCard key={barber.id} barber={barber} theme={theme} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="آراء العملاء"
            title="تجربة واضحة من أول زيارة"
            subtitle="هذه المساحة تعرض انطباعات مختصرة بدون ازدحام بصري."
            theme={theme}
          />
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.slice(0, 3).map((item, index) => (
              <article
                key={`${item.name}-${index}`}
                className="min-w-0 rounded-3xl border p-6"
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
              >
                <div className="mb-4 flex gap-1" style={{ color: theme.accent }}>
                  {[0, 1, 2, 3, 4].map((star) => (
                    <Star key={star} size={15} fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm font-bold leading-8" style={{ color: theme.muted }}>
                  "{item.quote || item.quote_ar}"
                </p>
                <div className="mt-5 border-t pt-4" style={{ borderColor: theme.border }}>
                  <h3 className="font-black" style={{ color: theme.text }}>
                    {item.name || item.name_ar}
                  </h3>
                  <p className="text-xs font-bold" style={{ color: theme.accent }}>
                    {item.role || item.role_ar || "عميل مميز"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border p-6 sm:p-8" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <SectionHeading
                eyebrow="التواصل"
                title={`زورنا في ${salonName}`}
                subtitle={settings?.address || "تواصل معنا لمعرفة العنوان وتأكيد الموعد المناسب لك."}
                theme={theme}
              />
              <div className="grid gap-3">
                {phone ? (
                  <a href={`tel:${phone}`} className="flex min-w-0 items-center gap-3 rounded-2xl border p-4" style={{ borderColor: theme.border }}>
                    <Phone size={20} style={{ color: theme.accent }} />
                    <span className="min-w-0 font-black" dir="ltr">{phone}</span>
                  </a>
                ) : null}
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-2xl border p-4" style={{ borderColor: theme.border }}>
                    <MessageCircle size={20} style={{ color: theme.accent }} />
                    <span className="min-w-0 font-black">تواصل عبر واتساب</span>
                  </a>
                ) : null}
                {mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-2xl border p-4" style={{ borderColor: theme.border }}>
                    <MapPin size={20} style={{ color: theme.accent }} />
                    <span className="min-w-0 font-black">عرض الموقع على الخريطة</span>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border p-5 sm:p-8" style={{ backgroundColor: theme.card, borderColor: theme.border }}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-black" style={{ color: theme.text }}>
                  ساعات العمل
                </h2>
                <span
                  className="rounded-2xl border px-4 py-2 text-xs font-black"
                  style={{
                    borderColor: isOpenNow ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)",
                    color: isOpenNow ? "#10B981" : "#F43F5E",
                  }}
                >
                  {isOpenNow ? "مفتوح الآن" : "مغلق الآن"}
                </span>
              </div>
              <div className="grid gap-3">
                {Object.entries(activeHours).map(([day, value]) => (
                  <div
                    key={day}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
                    style={{ borderColor: theme.border }}
                  >
                    <span className="font-black" style={{ color: theme.text }}>
                      {dayNames[day] || day}
                    </span>
                    <span className="text-sm font-black" style={{ color: value.is_open ? theme.accent : "#F43F5E" }}>
                      {value.is_open ? `${value.open_time} - ${value.close_time}` : "مغلق"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t px-4 py-10" style={{ borderColor: theme.border }}>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-start">
          <div>
            <h2 className="text-xl font-black" style={{ color: theme.text }}>
              {salonName}
            </h2>
            <p className="mt-1 text-xs font-bold" style={{ color: theme.muted }}>
              © 2026 جميع الحقوق محفوظة
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { href: settings?.socialFacebook, icon: Facebook, label: "Facebook" },
              { href: settings?.socialInstagram, icon: Instagram, label: "Instagram" },
              { href: settings?.socialTiktok, icon: Music2, label: "TikTok" },
              { href: settings?.socialYoutube, icon: Youtube, label: "YouTube" },
            ]
              .filter((item) => item.href)
              .map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                  style={{ borderColor: theme.border, color: theme.accent }}
                >
                  <item.icon size={19} />
                </a>
              ))}
          </div>
        </div>
      </footer>

      <div className="fixed inset-x-3 bottom-3 z-50 sm:hidden">
        <Button
          onClick={() => navigate(bookingPath)}
          className="min-h-14 w-full rounded-2xl text-sm shadow-2xl"
          style={{ backgroundColor: theme.accent, color: "#09090B" }}
        >
          <CalendarCheck2 size={18} />
          احجز موعدك الآن
        </Button>
      </div>
    </div>
  );
}
