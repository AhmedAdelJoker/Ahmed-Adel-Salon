import { motion } from "framer-motion";
import {
  Scissors,
  Star,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  Users,
  Award,
  ArrowRight,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Facebook,
  Instagram,
  Youtube,
  Music2,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { adaptObject } from "../services/apiAdapter";
import { buildPublicSalonPath, resolvePublicSlug } from "../lib/publicSite";
import { buildLandingSiteContent } from "../lib/publicSiteContent";
import { readPublicSitePreviewDraft } from "../lib/publicSitePreview";
import PublicBooking from "./PublicBooking";

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : "http://localhost:8000";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicSlug } = useParams();

  const [storedSettings, setStoredSettings] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const livePreviewEnabled = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("livePreview") === "1";
  }, [location.search]);
  const previewDraft = useMemo(() => {
    if (!livePreviewEnabled) return null;
    return readPublicSitePreviewDraft();
  }, [livePreviewEnabled, location.search]);
  const settings = previewDraft
    ? { ...(storedSettings || {}), ...previewDraft }
    : storedSettings;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const catalogRes = await api.get("/public/booking-catalog");
        const catalogData = adaptObject(catalogRes, {});
        setStoredSettings(catalogData?.business || {});
        setServices(
          Array.isArray(catalogData?.services) ? catalogData.services : [],
        );
      } catch (err) {
        console.error("Failed to fetch landing data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const resolveAssetUrl = (value) => {
    if (!value) return null;
    return String(value).startsWith("http") ? value : `${STATIC_URL}${value}`;
  };

  const normalizePhoneDigits = (value = "") =>
    String(value).replace(/[^\d+]/g, "");

  const galleryImages = Array.isArray(settings?.landingPortfolio)
    ? settings.landingPortfolio.filter(Boolean)
    : [];
  const landingContent = buildLandingSiteContent(settings || {});
  const salonName = settings?.salonName || settings?.salon_name || "صالون برو";
  const logoImage = resolveAssetUrl(settings?.logoUrl || settings?.logo_url);
  const heroBadgeText =
    landingContent.copy.landingHeroBadge || `${salonName} الاحترافي`;
  const coverImage = resolveAssetUrl(
    settings?.landingCoverImageUrl || settings?.landing_cover_image_url,
  );
  const heroImage =
    coverImage ||
    resolveAssetUrl(galleryImages[0]) ||
    resolveAssetUrl(settings?.logoUrl) ||
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2070&auto=format&fit=crop";
  const branchImage =
    resolveAssetUrl(galleryImages[0]) ||
    resolveAssetUrl(galleryImages[1]) ||
    coverImage ||
    "https://images.unsplash.com/photo-1593702295094-272a9f4454d7?q=80&w=2070&auto=format&fit=crop";
  const resolvedGallery = (
    galleryImages.length ? galleryImages : [branchImage, heroImage]
  )
    .map((image) => resolveAssetUrl(image) || image)
    .filter(Boolean);
  const atmosphereGallery = resolvedGallery.slice(0, 4);
  const trustBadges = landingContent.trustBadges.filter(Boolean);
  const testimonials = landingContent.testimonials.filter(
    (item) => item?.name || item?.quote,
  );
  const featureIcons = [Users, Award, Smartphone];

  const locationDescription =
    settings?.landingLocationDescription ||
    (settings?.address
      ? `نحن ننتظرك في ${settings.address}. صالون مجهز بأعلى مستويات الراحة والرفاهية لضمان تجربة لا تُنسى.`
      : landingContent.copy.landingLocationDescription);

  const whatsappDigits = normalizePhoneDigits(
    settings?.shopWhatsApp ||
      settings?.shop_whatsapp ||
      settings?.shopPhone ||
      "",
  );
  const whatsappNumber = whatsappDigits.startsWith("0")
    ? `2${whatsappDigits}`
    : whatsappDigits;
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `مرحباً، أريد الحجز في ${salonName}`,
      )}`
    : null;
  const phoneDigits = normalizePhoneDigits(
    settings?.shopPhone || settings?.shop_phone || "",
  );
  const phoneUrl = phoneDigits ? `tel:${phoneDigits}` : null;
  const mapsUrl =
    settings?.googleMapsUrl ||
    settings?.google_maps_url ||
    (settings?.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
      : null);

  const sectionLinks = [
    { id: "home", label: "الرئيسية", icon: Sparkles },
    { id: "about", label: "عن المحل", icon: Users },
    { id: "services", label: "خدماتنا", icon: Scissors },
    { id: "portfolio", label: "معرض الأعمال", icon: Star },
    { id: "booking", label: "الحجز", icon: Clock },
    { id: "contact", label: "اتصل بنا", icon: Phone },
  ];

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!publicSlug || !settings) return;
    const expectedSlug = resolvePublicSlug(settings);
    if (publicSlug !== expectedSlug) {
      navigate(buildPublicSalonPath(settings), { replace: true });
    }
  }, [navigate, publicSlug, settings]);

  useEffect(() => {
    if (!settings) return;
    if (location.pathname.endsWith("/book")) {
      const timer = window.setTimeout(() => scrollToSection("booking"), 150);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [location.pathname, settings]);

  const handleCTA = () => {
    scrollToSection("booking");
  };

  const isOpenNow = () => {
    if (!settings?.workingHours && !settings?.working_hours) return false;
    const workingHours = settings?.workingHours || settings?.working_hours;
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const now = new Date();
    const dayName = days[now.getDay()];
    const config = workingHours?.[dayName];

    if (!config?.is_open || !config?.open_time || !config?.close_time) {
      return false;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = config.open_time.split(":");
    const [closeH, closeM] = config.close_time.split(":");
    const openTotal = parseInt(openH, 10) * 60 + parseInt(openM, 10);
    const closeTotal = parseInt(closeH, 10) * 60 + parseInt(closeM, 10);

    return currentMinutes >= openTotal && currentMinutes <= closeTotal;
  };

  const openStateLabel = isOpenNow()
    ? landingContent.copy.landingLocationOpenLabel
    : landingContent.copy.landingLocationClosedLabel;
  const contactChannelsCount = [
    whatsappUrl,
    phoneUrl,
    settings?.socialFacebook,
    settings?.socialInstagram,
    settings?.socialTiktok,
    settings?.socialYoutube,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7efe8]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(176,118,45,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(23,17,14,0.10),transparent_30%)]" />
        <div className="relative flex flex-col items-center gap-4 rounded-[2rem] border border-white/70 bg-white/75 px-10 py-8 shadow-soft backdrop-blur-xl">
          <Sparkles className="h-12 w-12 animate-pulse text-accent" />
          <p className="text-sm font-black text-main">
            جاري تحميل واجهة الصالون...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-[#f7efe8] pb-28 text-main" dir="rtl">
      <section id="home" className="relative pb-16 pt-6 sm:pt-8 lg:pb-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(176,118,45,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(23,17,14,0.1),transparent_28%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#17110e] text-white shadow-[0_30px_90px_rgba(23,17,14,0.22)] ring-1 ring-black/5">
            <div className="border-b border-white/10 px-5 py-4 sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
                    {logoImage ? (
                      <img
                        src={logoImage}
                        alt={salonName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Scissors size={26} />
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                      {landingContent.copy.landingPublicHeaderBadge}
                    </p>
                    <h2 className="text-xl font-black text-white">
                      {salonName}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCTA}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-black text-white transition hover:scale-[1.02]"
                  >
                    احجز الآن
                  </button>
                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 text-sm font-black text-white transition hover:bg-white/10"
                    >
                      واتساب
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-12 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.75 }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.35em] text-amber-200">
                  <Sparkles size={14} />
                  <span>{heroBadgeText}</span>
                </div>

                <div className="space-y-5">
                  <h1 className="text-5xl font-black leading-[1.05] text-white sm:text-6xl xl:text-7xl">
                    {settings?.landingHeroTitle || "متسلمش دماغك لأي حد"}
                  </h1>
                  <p className="max-w-2xl text-base font-bold leading-8 text-white/72 sm:text-lg">
                    {settings?.landingHeroSubtitle ||
                      "تجربة حلاقة رجالية فاخرة بلمسة فنية واهتمام كامل بالتفاصيل، من أول استقبال وحتى آخر لمسة في اللوك النهائي."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={handleCTA}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-accent px-8 text-sm font-black text-white shadow-lg shadow-accent/25 transition hover:scale-[1.02]"
                  >
                    {landingContent.copy.landingFinalButtonLabel}
                    <ArrowRight size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("services")}
                    className="inline-flex h-14 items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 text-sm font-black text-white transition hover:bg-white/10"
                  >
                    استكشف خدماتنا
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {landingContent.stats.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
                    >
                      <div className="text-3xl font-black text-white">
                        {item.value}
                      </div>
                      <div className="mt-2 text-[11px] font-black uppercase tracking-[0.3em] text-amber-200">
                        {item.label}
                      </div>
                      <p className="mt-3 text-sm font-bold leading-6 text-white/65">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>

                {trustBadges.length ? (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {trustBadges.map((badge, index) => (
                      <div
                        key={`${badge}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-xs font-black text-white/80"
                      >
                        <ShieldCheck size={14} className="text-amber-300" />
                        {badge}
                      </div>
                    ))}
                  </div>
                ) : null}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9 }}
                className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"
              >
                <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10">
                  <img
                    src={heroImage}
                    alt={salonName}
                    className="h-full min-h-[420px] w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#120d0b] via-black/20 to-transparent" />
                  <div className="absolute bottom-5 right-5 left-5 rounded-[1.6rem] border border-white/10 bg-black/35 p-5 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
                          <Star size={20} className="fill-current" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">
                            {landingContent.copy.landingHeroHighlightTitle}
                          </p>
                          <p className="mt-1 text-xs font-bold text-white/70">
                            {landingContent.copy.landingHeroHighlightSubtitle}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">
                        {landingContent.copy.landingHeroHighlightBadge}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                      حالة المحل
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-white">
                          {openStateLabel}
                        </p>
                        <p className="text-xs font-bold text-white/70">
                          {landingContent.copy.landingLocationStatusText}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[2rem] border border-white/10">
                    <img
                      src={branchImage}
                      alt="أجواء المحل"
                      className="h-[250px] w-full object-cover"
                    />
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                      الوصول والتواصل
                    </p>
                    <div className="mt-4 space-y-3 text-sm font-bold text-white/80">
                      <div className="flex items-start gap-3">
                        <MapPin
                          size={16}
                          className="mt-1 shrink-0 text-amber-300"
                        />
                        <span>
                          {settings?.address || "أضف العنوان من الإعدادات"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone size={16} className="shrink-0 text-amber-300" />
                        <span>{settings?.shopPhone || "أضف رقم الهاتف"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-30 border-y border-[#2a1f18]/8 bg-[#f7efe8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-center lg:text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
              التنقل السريع
            </p>
            <h3 className="text-lg font-black text-main">
              الصفحة العامة للمحل
            </h3>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
            {sectionLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollToSection(link.id)}
                className="inline-flex items-center gap-2 rounded-full border border-[#2a1f18]/10 bg-white/80 px-4 py-2 text-xs font-black text-muted shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white hover:text-accent"
              >
                <link.icon size={14} />
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-24 scroll-mt-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <motion.div
              variants={fadeIn}
              initial="initial"
              whileInView="whileInView"
              className="space-y-6"
            >
              <div className="space-y-4 text-right">
                <p className="text-sm font-black uppercase tracking-[0.35em] text-accent">
                  عن المحل
                </p>
                <h2 className="text-4xl font-black text-main sm:text-5xl">
                  {settings?.landingAboutTitle || "تجربة حلاقة تستحقها"}
                </h2>
                <p className="text-base font-bold leading-8 text-muted">
                  {settings?.landingAboutContent ||
                    "نمزج بين الدقة والراحة والذوق العصري، لنمنحك جلسة حلاقة متكاملة تبدأ من الاستقبال وتنتهي بإطلالة محسوبة على أدق التفاصيل."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {landingContent.features.map((feature, index) => {
                  const FeatureIcon = featureIcons[index] || ShieldCheck;
                  return (
                    <div
                      key={`${feature.title}-${index}`}
                      className="rounded-[1.8rem] border border-[#2a1f18]/10 bg-white p-5 shadow-soft"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                        <FeatureIcon size={22} />
                      </div>
                      <h3 className="mt-4 text-lg font-black text-main">
                        {feature.title}
                      </h3>
                      <p className="mt-3 text-sm font-bold leading-7 text-muted">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              variants={fadeIn}
              initial="initial"
              whileInView="whileInView"
              className="grid gap-4 sm:grid-cols-2"
            >
              {atmosphereGallery.map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className={`overflow-hidden rounded-[2rem] border border-[#2a1f18]/10 bg-white shadow-soft ${
                    index === 0 ? "sm:col-span-2" : ""
                  }`}
                >
                  <img
                    src={image}
                    alt={`أجواء ${salonName}`}
                    className={`w-full object-cover transition-transform duration-700 hover:scale-105 ${
                      index === 0 ? "h-[320px]" : "h-[210px]"
                    }`}
                  />
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-[#efe3d4] py-20">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-10 flex flex-col gap-4 text-right lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-accent">
                أجواء وتجربة
              </p>
              <h2 className="mt-3 text-4xl font-black text-main">
                المكان جزء من التجربة
              </h2>
            </div>
            <p className="max-w-2xl text-base font-bold leading-8 text-muted">
              استلهمنا هذا القسم من المواقع الفاخرة المشابهة، لكن جعلناه أكثر
              دفئًا وتنظيمًا ليعكس براند صالونك ويخدم الحجز بشكل أوضح.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="overflow-hidden rounded-[2.4rem] border border-[#2a1f18]/10 shadow-soft">
              <img
                src={heroImage}
                alt={salonName}
                className="h-full min-h-[420px] w-full object-cover"
              />
            </div>

            <div className="grid gap-4">
              <div className="rounded-[2rem] border border-[#2a1f18]/10 bg-white p-6 shadow-soft">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                  لماذا نتميز
                </p>
                <div className="mt-5 space-y-4">
                  {landingContent.features.map((feature, index) => (
                    <div
                      key={`${feature.title}-why-${index}`}
                      className="rounded-2xl border border-[#2a1f18]/8 bg-[#f8f2eb] p-4"
                    >
                      <p className="text-sm font-black text-main">
                        {feature.title}
                      </p>
                      <p className="mt-2 text-sm font-bold leading-7 text-muted">
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {resolvedGallery.slice(0, 2).map((image, index) => (
                  <div
                    key={`${image}-mini-${index}`}
                    className="overflow-hidden rounded-[1.8rem] border border-[#2a1f18]/10 shadow-soft"
                  >
                    <img
                      src={image}
                      alt={`تفاصيل ${salonName}`}
                      className="h-[190px] w-full object-cover transition-transform duration-700 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-24 scroll-mt-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-16 flex flex-col gap-4 text-right lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-accent">
                {landingContent.copy.landingServicesEyebrow}
              </p>
              <h2 className="text-4xl font-black text-main sm:text-5xl">
                {landingContent.copy.landingServicesTitle}
              </h2>
            </div>
            <p className="max-w-2xl text-base font-bold leading-8 text-muted">
              {landingContent.copy.landingServicesSubtitle}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(Array.isArray(services) ? services : [])
              .slice(0, 6)
              .map((service, index) => {
                const serviceImage = service.image_url
                  ? service.image_url.startsWith("http")
                    ? service.image_url
                    : `${STATIC_URL}${service.image_url}`
                  : heroImage;
                return (
                  <motion.div
                    key={`${service.name}-${index}`}
                    variants={fadeIn}
                    initial="initial"
                    whileInView="whileInView"
                    className="group overflow-hidden rounded-[2rem] border border-[#2a1f18]/10 bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={serviceImage}
                        alt={service.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-xs font-black text-white backdrop-blur-md">
                        <Clock size={13} />
                        <span>
                          {service.duration_minutes || service.duration || 30}{" "}
                          دقيقة
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-black text-main">
                            {service.name}
                          </h3>
                          <p className="mt-2 text-sm font-bold leading-7 text-muted">
                            خدمة مميزة ضمن تجربة {salonName} مع اهتمام كامل
                            بالنتيجة النهائية والراحة أثناء الجلسة.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-black text-accent">
                          {service.price} {settings?.currency || "ج.م"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => scrollToSection("booking")}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#2a1f18]/10 px-6 text-sm font-black text-main transition hover:border-accent/40 hover:text-accent"
                      >
                        احجز هذه الخدمة
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </div>
      </section>

      <section
        id="portfolio"
        className="scroll-mt-28 bg-[#17110e] py-24 text-white"
      >
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-16 text-center">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-amber-300">
              {landingContent.copy.landingPortfolioEyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-black sm:text-5xl">
              {landingContent.copy.landingPortfolioTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base font-bold leading-8 text-white/65">
              نماذج من الستايل والنتائج التي تعكس شغلنا الحقيقي ولمستنا في
              التفاصيل.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resolvedGallery.map((image, index) => (
              <motion.div
                key={`${image}-portfolio-${index}`}
                variants={fadeIn}
                initial="initial"
                whileInView="whileInView"
                className={`group overflow-hidden rounded-[2rem] border border-white/10 ${
                  index % 5 === 0 ? "sm:col-span-2" : ""
                }`}
              >
                <img
                  src={image}
                  alt={`عمل ${index + 1}`}
                  className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${
                    index % 5 === 0 ? "h-[360px]" : "h-[260px]"
                  }`}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-16 text-center">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-accent">
              {landingContent.copy.landingTestimonialsEyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-black text-main sm:text-5xl">
              {landingContent.copy.landingTestimonialsTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base font-bold leading-8 text-muted">
              {landingContent.copy.landingTestimonialsSubtitle}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {testimonials.map((item, index) => (
              <motion.div
                key={`${item.name}-${index}`}
                variants={fadeIn}
                initial="initial"
                whileInView="whileInView"
                className="rounded-[2rem] border border-[#2a1f18]/10 bg-white p-6 shadow-soft"
              >
                <div className="flex items-center gap-1 text-accent">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={16} className="fill-current" />
                  ))}
                </div>
                <p className="mt-5 text-base font-bold leading-8 text-main">
                  "{item.quote}"
                </p>
                <div className="mt-6 border-t border-[#2a1f18]/10 pt-4">
                  <p className="text-lg font-black text-main">{item.name}</p>
                  <p className="mt-1 text-sm font-bold text-muted">
                    {item.role}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="booking" className="py-24 scroll-mt-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="mb-16 grid gap-8 rounded-[2.4rem] border border-[#2a1f18]/10 bg-white p-6 shadow-soft lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
            <div className="space-y-4 text-right">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-accent">
                {landingContent.copy.landingBookingEyebrow}
              </p>
              <h2 className="text-4xl font-black text-main sm:text-5xl">
                {landingContent.copy.landingBookingTitle}
              </h2>
              <p className="text-base font-bold leading-8 text-muted">
                {landingContent.copy.landingBookingSubtitle}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.6rem] bg-[#f8f2eb] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                  1
                </p>
                <h3 className="mt-3 text-lg font-black text-main">
                  اختر الخدمة
                </h3>
                <p className="mt-2 text-sm font-bold leading-7 text-muted">
                  حدد الخدمات التي تريدها حسب الوقت والسعر المناسبين لك.
                </p>
              </div>
              <div className="rounded-[1.6rem] bg-[#f8f2eb] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                  2
                </p>
                <h3 className="mt-3 text-lg font-black text-main">
                  حدد الموعد
                </h3>
                <p className="mt-2 text-sm font-bold leading-7 text-muted">
                  اختر الحلاق والموعد المتاح ثم أكمل بياناتك بسهولة.
                </p>
              </div>
              <div className="rounded-[1.6rem] bg-[#f8f2eb] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                  3
                </p>
                <h3 className="mt-3 text-lg font-black text-main">
                  تأكيد فوري
                </h3>
                <p className="mt-2 text-sm font-bold leading-7 text-muted">
                  يتم تسجيل الحجز مباشرة داخل النظام وربطه ببيانات المحل.
                </p>
              </div>
            </div>
          </div>

          <PublicBooking embedded />
        </div>
      </section>

      <section id="contact" className="scroll-mt-28 bg-[#efe3d4] py-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2.4rem] bg-[#17110e] p-6 text-white shadow-premium sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-amber-300">
                {landingContent.copy.landingContactEyebrow}
              </p>
              <h2 className="mt-4 text-4xl font-black sm:text-5xl">
                {landingContent.copy.landingContactTitle}
              </h2>
              <p className="mt-4 text-base font-bold leading-8 text-white/68">
                {landingContent.copy.landingContactSubtitle}
              </p>

              <div className="mt-8 grid gap-4">
                <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 text-amber-300" size={18} />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                        {landingContent.copy.landingLocationTitle}
                      </p>
                      <p className="mt-3 text-sm font-bold leading-7 text-white/75">
                        {locationDescription}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                      الهاتف
                    </p>
                    <p className="mt-3 text-lg font-black text-white">
                      {settings?.shopPhone || "أضف الهاتف من الإعدادات"}
                    </p>
                  </div>
                  <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">
                      القنوات المتاحة
                    </p>
                    <p className="mt-3 text-lg font-black text-white">
                      {contactChannelsCount} قنوات تواصل
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  {settings?.socialFacebook && (
                    <a
                      href={settings.socialFacebook}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-blue-600"
                    >
                      <Facebook size={18} />
                    </a>
                  )}
                  {settings?.socialInstagram && (
                    <a
                      href={settings.socialInstagram}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-pink-600"
                    >
                      <Instagram size={18} />
                    </a>
                  )}
                  {settings?.socialTiktok && (
                    <a
                      href={settings.socialTiktok}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-black"
                    >
                      <Music2 size={18} />
                    </a>
                  )}
                  {settings?.socialYoutube && (
                    <a
                      href={settings.socialYoutube}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-red-600"
                    >
                      <Youtube size={18} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[2.4rem] border border-[#2a1f18]/10 bg-white p-6 shadow-soft sm:p-8">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-accent">
                {landingContent.copy.landingQuickActionsEyebrow}
              </p>
              <h2 className="mt-4 text-4xl font-black text-main sm:text-5xl">
                {landingContent.copy.landingQuickActionsTitle}
              </h2>
              <p className="mt-4 text-base font-bold leading-8 text-muted">
                {landingContent.copy.landingQuickActionsSubtitle}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => scrollToSection("booking")}
                  className="inline-flex h-16 items-center justify-center rounded-[1.4rem] bg-accent px-6 text-base font-black text-white shadow-lg shadow-accent/20 transition hover:scale-[1.02]"
                >
                  احجز الآن
                </button>

                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-16 items-center justify-center rounded-[1.4rem] border border-[#2a1f18]/10 px-6 text-base font-black text-main transition hover:border-accent/40 hover:text-accent"
                  >
                    ابدأ محادثة واتساب
                  </a>
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-[1.4rem] border border-dashed border-[#2a1f18]/10 bg-[#f8f2eb] px-4 text-center text-sm font-bold text-muted">
                    أضف رقم واتساب من الإعدادات لتفعيل الزر
                  </div>
                )}

                {phoneUrl ? (
                  <a
                    href={phoneUrl}
                    className="inline-flex h-16 items-center justify-center rounded-[1.4rem] border border-[#2a1f18]/10 px-6 text-base font-black text-main transition hover:border-accent/40 hover:text-accent"
                  >
                    اتصل بالمحل
                  </a>
                ) : null}

                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-16 items-center justify-center rounded-[1.4rem] border border-[#2a1f18]/10 px-6 text-base font-black text-main transition hover:border-accent/40 hover:text-accent"
                  >
                    افتح الموقع على الخريطة
                  </a>
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-[1.4rem] border border-dashed border-[#2a1f18]/10 bg-[#f8f2eb] px-4 text-center text-sm font-bold text-muted">
                    أضف رابط الخريطة أو عنوانًا واضحًا من الإعدادات
                  </div>
                )}
              </div>

              <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#2a1f18]/10">
                <img
                  src={branchImage}
                  alt={`واجهة ${salonName}`}
                  className="h-[260px] w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-grad-accent py-24">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-20" />
        <div className="relative z-10 mx-auto max-w-7xl px-6 text-center sm:px-8">
          <h2 className="whitespace-pre-line text-4xl font-black leading-tight text-white sm:text-6xl">
            {landingContent.copy.landingFinalTitle}
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg font-bold leading-8 text-white/82">
            {landingContent.copy.landingFinalSubtitle}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleCTA}
              className="inline-flex h-16 items-center justify-center rounded-full bg-white px-12 text-lg font-black text-accent shadow-2xl transition hover:bg-[#f8f2eb]"
            >
              {landingContent.copy.landingFinalButtonLabel}
            </button>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-16 items-center justify-center rounded-full border border-white/20 bg-white/10 px-10 text-lg font-black text-white transition hover:bg-white/15"
              >
                احجز عبر واتساب
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-white/10 bg-[#16110d]/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
              {logoImage ? (
                <img
                  src={logoImage}
                  alt={salonName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Scissors size={18} className="text-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                جاهز للحجز
              </p>
              <p className="truncate text-sm font-black text-white">
                {salonName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {phoneUrl ? (
              <a
                href={phoneUrl}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10"
              >
                اتصال
              </a>
            ) : null}
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10"
              >
                واتساب
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => scrollToSection("booking")}
              className="rounded-full bg-accent px-5 py-2 text-xs font-black text-white shadow-lg shadow-accent/30 transition hover:scale-[1.02]"
            >
              احجز الآن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
