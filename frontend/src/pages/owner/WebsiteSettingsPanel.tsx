import {
  Globe,
  Layout,
  Image as ImageIcon,
  Share2,
  Plus,
  Trash2,
  Save,
  Facebook,
  Instagram,
  Youtube,
  Music2,
  Star,
  Link2,
  ShieldCheck,
  FileText,
  Palette,
  Check,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { PremiumCard, StatCard, SkeletonCard } from "@/components/shared/PremiumUI";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { staticURL } from "@/services/api";
import type { LucideIcon } from "lucide-react";
import { useWebsiteSettings } from "@/features/website-settings";
import { useState, useEffect, useRef } from "react";

const TAB_ICONS: Record<string, LucideIcon> = {
  content: Layout,
  sections: Globe,
  portfolio: ImageIcon,
  social: Share2,
  extras: FileText,
  design: Palette,
};

/**
 * The public site's palettes, mirrored from `public-site/src/lib/theme.ts`.
 *
 * These are literal hex values rather than the admin app's own tokens on
 * purpose: this picker is describing the *visitor-facing* site, which has its
 * own palette system. Reading these from `--accent` here would show the owner's
 * swatch and quietly apply a different one.
 *
 * Three brand identities, each with a dark and a light ground. The ground is
 * what changes when a visitor flips appearance; the accent — the thing the
 * owner is actually choosing — stays put, which is why the two entries of a
 * pair share a hue.
 */
const SITE_PALETTES = [
  {
    brand: "ember",
    brandLabel: "جمر",
    brandNote: "دافئ، جريء، واضح",
    options: [
      {
        id: "midnight",
        label: "حبر داكن",
        note: "أسود مزرقّ مع مرجاني",
        isDark: true,
        bg: "#080B11",
        card: "#131A24",
        accent: "#FF5A36",
      },
      {
        id: "gold",
        label: "عاجي فاتح",
        note: "ورقي دافئ مع قرمزي",
        isDark: false,
        bg: "#F3EFE6",
        card: "#FFFDF8",
        accent: "#D93B18",
      },
    ],
  },
  {
    brand: "verdant",
    brandLabel: "أخضر",
    brandNote: "طبيعي، حيوي، مميز",
    options: [
      {
        id: "moss",
        label: "غابة داكنة",
        note: "أخضر داكن مع ليموني",
        isDark: true,
        bg: "#0A100C",
        card: "#131D16",
        accent: "#A9E82E",
      },
      {
        id: "clay",
        label: "طين فاتح",
        note: "طين دافئ مع فيروزي",
        isDark: false,
        bg: "#F6EBE1",
        card: "#FFFBF6",
        accent: "#0E7268",
      },
    ],
  },
  {
    brand: "azure",
    brandLabel: "أزرق",
    brandNote: "هادئ، نظيف، احترافي",
    options: [
      {
        id: "graphite",
        label: "جرافيت داكن",
        note: "رمادي مزرقّ مع سماوي",
        isDark: true,
        bg: "#0A1017",
        card: "#151F2C",
        accent: "#4C9EF5",
      },
      {
        id: "silver",
        label: "فضي فاتح",
        note: "رمادي بارد dengan أزرق",
        isDark: false,
        bg: "#EDF1F6",
        card: "#FFFFFF",
        accent: "#0B5CC4",
      },
    ],
  },
] as const;

const WebsiteSettingsPanel = ({ onSaved, onChangeDraft, embedded = false }: { onSaved?: () => void; onChangeDraft?: (s: any) => void; embedded?: boolean }) => {
  const {
    loading,
    saving,
    activeSubTab,
    setActiveSubTab,
    settings,
    setSettings,
    updateField,
    handleSaveSettings,
    handleAddPortfolioImage,
    handleCoverImageUpload,
    removeCoverImage,
    handleHeroVideoUpload,
    removeHeroVideo,
    removePortfolioImage,
    updateArrayItem,
    SUB_TABS,
  } = useWebsiteSettings({ onSaved, onChangeDraft });

  const [coverFailed, setCoverFailed] = useState(false);
  const [failedPortfolio, setFailedPortfolio] = useState<Record<number, boolean>>({});
  const initialSnapshotRef = useRef<string | null>(null);
  const hasUnsaved = (() => {
    if (loading || !initialSnapshotRef.current) return false;
    try {
      return JSON.stringify(settings) !== initialSnapshotRef.current;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!loading && initialSnapshotRef.current === null) {
      try {
        initialSnapshotRef.current = JSON.stringify(settings);
      } catch {
        initialSnapshotRef.current = null;
      }
    }
  }, [loading, settings]);

  useEffect(() => {
    if (hasUnsaved && !saving) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [hasUnsaved, saving]);

  // reset snapshot after successful save
  const prevSavingRef = useRef(saving);
  useEffect(() => {
    if (prevSavingRef.current && !saving && !hasUnsaved) {
      // saving finished and no unsaved means we should update snapshot to current?
    }
    if (prevSavingRef.current && !saving) {
      try {
        initialSnapshotRef.current = JSON.stringify(settings);
      } catch {}
    }
    prevSavingRef.current = saving;
  }, [saving, settings, hasUnsaved]);

  const activeTabMeta = SUB_TABS.find((tab) => tab.id === activeSubTab) || SUB_TABS[0];
  const ActiveTabIcon = TAB_ICONS[activeTabMeta.id] || Layout;

  const stats = {
    cover: settings.landingCoverImageUrl ? "غلاف جاهز" : "بدون غلاف",
    portfolioCount: settings.landingPortfolio.length,
    socialCount: [settings.socialFacebook, settings.socialInstagram, settings.socialTiktok, settings.socialYoutube].filter(Boolean).length,
    badges: settings.landingTrustBadges.filter((item: any) => item.label).length,
    testimonials: settings.landingTestimonials.filter((item: any) => item.quote).length,
  };

  if (loading)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </div>
        <SkeletonCard variant="content" />
      </div>
    );

  return (
    <div className={`space-y-6 ${embedded ? "" : "animate-in fade-in duration-500"}`}>
      {/* Overview Stats — unified with StatCard */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          label="العرض الرئيسي"
          value={stats.cover}
          icon={ImageIcon}
          variant={settings.landingCoverImageUrl ? "success" : "secondary"}
          delay={0}
        />
        <StatCard
          label="المعرض"
          value={`${stats.portfolioCount}`}
          icon={Layout}
          variant={stats.portfolioCount > 0 ? "primary" : "secondary"}
          delay={0.05}
        />
        <StatCard
          label="روابط التواصل"
          value={`${stats.socialCount}/4`}
          icon={Link2}
          variant={stats.socialCount > 0 ? "info" : "secondary"}
          delay={0.1}
        />
        <StatCard
          label="شارات الثقة"
          value={`${stats.badges}/3`}
          icon={ShieldCheck}
          variant={stats.badges > 0 ? "warning" : "secondary"}
          delay={0.15}
        />
        <StatCard
          label="التقييمات"
          value={`${stats.testimonials}/3`}
          icon={Star}
          variant={stats.testimonials > 0 ? "success" : "secondary"}
          delay={0.2}
        />
      </div>

      {/* Sub-tabs — professional Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/10">
            <ActiveTabIcon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-main">{activeTabMeta.label}</h3>
            <p className="text-[11px] font-bold text-muted">{activeTabMeta.description}</p>
          </div>
        </div>
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto flex flex-wrap gap-1 h-auto p-1.5 rounded-2xl bg-soft border border-border">
            {SUB_TABS.map((tab) => {
              const TabIcon = TAB_ICONS[tab.id] || Layout;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 rounded-xl text-[11px] font-black data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border px-3 py-2.5 flex-1 sm:flex-none justify-center"
                >
                  <TabIcon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden text-[10px]">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "content" && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PremiumCard className="space-y-6">
                <SectionGroup title="القسم الرئيسي (Hero)" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="hero-badge" className="text-[10px] font-black text-muted uppercase tracking-widest">
                      شارة أعلى الصفحة
                    </label>
                    <Input
                      id="hero-badge"
                      value={settings.landingHeroBadge || ""}
                      onChange={(e) => updateField("landingHeroBadge", e.target.value)}
                      className="h-11 bg-soft border-border font-bold rounded-xl"
                      placeholder="مثلاً: أهلاً بك في صالون..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="hero-title" className="text-[10px] font-black text-muted uppercase tracking-widest">
                      العنوان الرئيسي
                    </label>
                    <Input
                      id="hero-title"
                      value={settings.landingHeroTitle || ""}
                      onChange={(e) => updateField("landingHeroTitle", e.target.value)}
                      className="h-11 bg-soft border-border font-black rounded-xl"
                      placeholder="عنوان جذاب"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="hero-subtitle" className="text-[10px] font-black text-muted uppercase tracking-widest">
                      الوصف الفرعي
                    </label>
                    <textarea
                      id="hero-subtitle"
                      value={settings.landingHeroSubtitle || ""}
                      onChange={(e) => updateField("landingHeroSubtitle", e.target.value)}
                      className="w-full min-h-[100px] rounded-xl bg-soft border border-border p-4 text-xs font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                      placeholder="وصف مختصر يظهر تحت العنوان"
                    />
                  </div>
                </div>
              </PremiumCard>

              <PremiumCard className="space-y-6">
                <SectionGroup title="قسم من نحن (About)" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="about-title" className="text-[10px] font-black text-muted uppercase tracking-widest">
                      عنوان القسم
                    </label>
                    <Input
                      id="about-title"
                      value={settings.landingAboutTitle || ""}
                      onChange={(e) => updateField("landingAboutTitle", e.target.value)}
                      className="h-11 bg-soft border-border font-bold rounded-xl"
                      placeholder="من نحن"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="about-content" className="text-[10px] font-black text-muted uppercase tracking-widest">
                      المحتوى
                    </label>
                    <textarea
                      id="about-content"
                      value={settings.landingAboutContent || ""}
                      onChange={(e) => updateField("landingAboutContent", e.target.value)}
                      className="w-full min-h-[150px] rounded-xl bg-soft border border-border p-4 text-xs font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                      placeholder="نص تعريفي عن الصالون"
                    />
                  </div>
                </div>
              </PremiumCard>
            </div>
          </motion.div>
        )}
        {activeSubTab === "sections" && (
          <motion.div
            key="sections"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard className="space-y-10">
              <SectionGroup title="الإحصاءات الرئيسية">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(settings.landingStats as { value?: string; label?: string }[]).map((item, index) => (
                    <div key={index} className="space-y-3 rounded-2xl border border-border bg-soft/40 p-4">
                      <Input
                        value={item.value || ""}
                        onChange={(e) => updateArrayItem("landingStats", index, "value", e.target.value)}
                        className="h-10 bg-card border-border font-black text-sm rounded-xl"
                        placeholder="القيمة (مثال: 15k+)"
                        aria-label={`قيمة إحصاء ${index + 1}`}
                      />
                      <Input
                        value={item.label || ""}
                        onChange={(e) => updateArrayItem("landingStats", index, "label", e.target.value)}
                        className="h-10 bg-card border-border font-bold text-xs rounded-xl"
                        placeholder="العنوان"
                        aria-label={`عنوان إحصاء ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="مميزات المنشأة">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(settings.landingFeatures as { title?: string; description?: string }[]).map((item, index) => (
                    <div key={index} className="space-y-3 rounded-2xl border border-border bg-soft/40 p-4">
                      <Input
                        value={item.title || ""}
                        onChange={(e) => updateArrayItem("landingFeatures", index, "title", e.target.value)}
                        className="h-10 bg-card border-border font-black text-sm rounded-xl"
                        placeholder="عنوان الميزة"
                        aria-label={`عنوان ميزة ${index + 1}`}
                      />
                      <textarea
                        value={item.description || ""}
                        onChange={(e) => updateArrayItem("landingFeatures", index, "description", e.target.value)}
                        className="min-h-[80px] w-full rounded-xl border border-border bg-card p-3 text-[11px] font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                        placeholder="وصف مختصر"
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="عناوين ونصوص الأقسام">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {(
                    [
                      ["landingServicesTitle", "عنوان الخدمات", false],
                      ["landingServicesSubtitle", "وصف الخدمات", true],
                      ["landingPortfolioTitle", "عنوان المعرض", false],
                      ["landingBookingTitle", "عنوان الحجز", false],
                      ["landingBookingSubtitle", "وصف الحجز", true],
                      ["landingLocationTitle", "عنوان الموقع", false],
                      ["landingContactTitle", "عنوان التواصل", false],
                    ] as [string, string, boolean][]
                  ).map(([key, label, multiline]) => (
                    <div key={key} className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">{label}</label>
                      {multiline ? (
                        <textarea
                          value={String(settings[key] ?? "")}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="min-h-[80px] w-full rounded-xl border border-border bg-soft p-4 text-[11px] font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                      ) : (
                        <Input
                          value={String(settings[key] ?? "")}
                          onChange={(e) => updateField(key, e.target.value)}
                          className="h-11 bg-soft border-border font-bold rounded-xl"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </SectionGroup>
            </PremiumCard>
          </motion.div>
        )}
        {activeSubTab === "portfolio" && (
          <motion.div
            key="portfolio"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard className="space-y-8">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-border bg-soft/40 p-5">
                  <SectionGroup title="صورة الغلاف" />
                  <p className="text-xs font-bold leading-relaxed text-muted">صورة Hero تظهر كواجهة أولى في موقع المحل. يُفضل نسبة 16:9 بدقة عالية.</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <label className="h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[11px] font-black text-white shadow-md hover:bg-primary/90 transition-colors flex">
                      <Plus size={14} /> {settings.landingCoverImageUrl ? "استبدال الغلاف" : "رفع الغلاف"}
                      <input type="file" className="hidden" accept="image/*" onChange={handleCoverImageUpload} />
                    </label>
                    {settings.landingCoverImageUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={removeCoverImage}
                        className="text-danger border-danger/20 bg-card hover:bg-danger-soft hover:text-danger text-[11px] rounded-xl h-10"
                      >
                        <Trash2 size={14} className="ms-1" /> حذف
                      </Button>
                    )}
                  </div>
                  {settings.landingCoverImageUrl && (
                    <Badge variant="secondary" className="rounded-full text-[10px] font-black">
                      <ImageIcon size={10} /> صورة مرفوعة
                    </Badge>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-soft aspect-video flex items-center justify-center">
                  {settings.landingCoverImageUrl && !coverFailed ? (
                    <img
                      src={settings.landingCoverImageUrl.startsWith("http") ? settings.landingCoverImageUrl : `${staticURL}${settings.landingCoverImageUrl}`}
                      className="h-full w-full object-cover"
                      alt="غلاف الموقع"
                      onError={() => setCoverFailed(true)}
                    />
                  ) : (
                    <div className="text-center text-muted p-6">
                      <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <ImageIcon size={22} className="opacity-60" />
                      </div>
                      <p className="text-[11px] font-black uppercase tracking-widest opacity-60">لا يوجد غلاف حالياً</p>
                      <p className="text-[10px] font-bold text-muted mt-1">ارفع صورة لمعاينتها هنا</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Hero video + motion ───────────────────────────────────────
                  Sits next to the cover image because they occupy the same slot
                  on the page: the poster is what shows before the clip loads,
                  and if the owner clears the video the poster is what remains. */}
              <div className="space-y-4 rounded-2xl border border-border bg-soft/40 p-5">
                <SectionGroup title="فيديو الغلاف (اختياري)" />
                <p className="text-xs font-bold leading-relaxed text-muted">
                  فيديو قصير (10–15 ثانية) يظهر خلف عنوان الصفحة. الصيغ المدعومة MP4 و WebM، والحد الأقصى 25 م.ب.
                  <span className="block mt-1 text-danger/80">
                    مهم: صورة الغلاف مطلوبة — تُستخدم كصورة بديلة قبل تحميل الفيديو.
                  </span>
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <label className="h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[11px] font-black text-white shadow-md hover:bg-primary/90 transition-colors flex">
                    <Video size={14} /> {settings.landingHeroVideoUrl ? "استبدال الفيديو" : "رفع فيديو"}
                    <input
                      type="file"
                      className="hidden"
                      accept="video/mp4,video/webm,.mp4,.webm"
                      onChange={handleHeroVideoUpload}
                    />
                  </label>
                  {settings.landingHeroVideoUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={removeHeroVideo}
                      className="text-danger border-danger/20 bg-card hover:bg-danger-soft hover:text-danger text-[11px] rounded-xl h-10"
                    >
                      <Trash2 size={14} className="ms-1" /> حذف
                    </Button>
                  )}
                </div>

                {settings.landingHeroVideoUrl && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full text-[10px] font-black">
                        <Video size={10} /> فيديو مرفوع
                      </Badge>
                      {!settings.landingVideoPosterUrl && (
                        <Badge variant="warning" className="rounded-full text-[10px] font-black">
                          بدون صورة بديلة
                        </Badge>
                      )}
                    </div>

                    {/* Preview. `muted` + `playsInline` mirror the public hero,
                        because an autoplaying preview would otherwise be refused
                        by the browser and look broken in the panel. */}
                    <div className="overflow-hidden rounded-xl border border-border bg-black aspect-video">
                      <video
                        key={settings.landingHeroVideoUrl}
                        src={
                          settings.landingHeroVideoUrl.startsWith("http")
                            ? settings.landingHeroVideoUrl
                            : `${staticURL}${settings.landingHeroVideoUrl}`
                        }
                        poster={
                          settings.landingVideoPosterUrl ||
                          (settings.landingCoverImageUrl
                            ? `${staticURL}${settings.landingCoverImageUrl}`
                            : undefined)
                        }
                        className="h-full w-full object-cover"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer">
                      <span className="text-[11px] font-black text-main">تشغيل الفيديو تلقائياً</span>
                      <input
                        type="checkbox"
                        checked={settings.landingVideoAutoplay}
                        onChange={(e) =>
                          setSettings((p) => ({ ...p, landingVideoAutoplay: e.target.checked }))
                        }
                        className="w-4 h-4 accent-primary"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Motion master switch. Explicitly framed as "not overriding the
                  visitor's device setting" because an owner who turns this on
                  expects animation everywhere, and it still will not be — the
                  OS preference wins, always. */}
              <div className="space-y-4 rounded-2xl border border-border bg-soft/40 p-5">
                <SectionGroup title="الحركة والانتقالات" />
                <p className="text-xs font-bold leading-relaxed text-muted">
                  ظهور تدريجي للأقسام عند التمرير. هذا الخيار لا يتجاوز تفضيل جهاز الزائر: إذا كان نظامه يطلب تقليل الحركة، فلن تُعرض أي حركة.
                </p>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer">
                  <span className="text-[11px] font-black text-main">تفعيل أنميشن التمرير</span>
                  <input
                    type="checkbox"
                    checked={settings.landingMotionEnabled}
                    onChange={(e) =>
                      setSettings((p) => ({ ...p, landingMotionEnabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-primary"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <SectionGroup title="معرض الأعمال" />
                  <div className="flex items-center gap-2">
                    <Badge variant="primary" className="rounded-full tabular-nums">
                      {settings.landingPortfolio.length}/20
                    </Badge>
                    <label className={`h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-[11px] font-black shadow-md flex transition-colors ${settings.landingPortfolio.length >= 20 ? "bg-soft text-muted border border-border cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90"}`}>
                      <Plus size={14} /> إضافة صورة
                      <input type="file" className="hidden" accept="image/*" onChange={handleAddPortfolioImage} disabled={settings.landingPortfolio.length >= 20} />
                    </label>
                  </div>
                </div>

                {settings.landingPortfolio.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {settings.landingPortfolio.map((url: string, idx: number) => (
                      <div key={`${url}-${idx}`} className="group relative aspect-square rounded-2xl overflow-hidden border border-border bg-soft shadow-sm">
                        {!failedPortfolio[idx] ? (
                          <img
                            src={url.startsWith("http") ? url : `${staticURL}${url}`}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            alt={`معرض ${idx + 1}`}
                            onError={() => setFailedPortfolio((p) => ({ ...p, [idx]: true }))}
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted p-4">
                            <ImageIcon size={20} className="opacity-40" />
                            <span className="text-[10px] font-bold">فشل التحميل</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => removePortfolioImage(idx)}
                            className="h-9 w-9 rounded-xl bg-danger text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                            aria-label={`حذف صورة ${idx + 1}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-black rounded-full px-2 py-0.5">#{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="المعرض فارغ"
                    message="أضف صور أعمالك — ستظهر كشبكة جذابة في صفحة العميل."
                    icon={ImageIcon}
                    action={
                      <label className="h-11 cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary px-6 text-xs font-black text-white shadow-md hover:bg-primary/90 transition-colors">
                        <Plus size={16} /> رفع أول صورة
                        <input type="file" className="hidden" accept="image/*" onChange={handleAddPortfolioImage} />
                      </label>
                    }
                  />
                )}
              </div>
            </PremiumCard>
          </motion.div>
        )}
        {activeSubTab === "social" && (
          <motion.div
            key="social"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard>
              <SectionGroup title="روابط التواصل" />
              <p className="text-xs font-bold text-muted -mt-3 mb-6">تظهر كأيقونات في تذييل الموقع العام. اترك الحقل فارغاً لإخفاء القناة.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(
                  [
                    { id: "socialFacebook", label: "Facebook", icon: Facebook, color: "text-[#1877F2]" },
                    { id: "socialInstagram", label: "Instagram", icon: Instagram, color: "text-[#E4405F]" },
                    { id: "socialTiktok", label: "TikTok", icon: Music2, color: "text-main" },
                    { id: "socialYoutube", label: "YouTube", icon: Youtube, color: "text-[#FF0000]" },
                  ] as { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }[]
                ).map((social) => (
                  <div key={social.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-soft border border-border flex items-center justify-center">
                        <social.icon size={14} className={social.color} />
                      </div>
                      <label htmlFor={social.id} className="text-[10px] font-black text-muted uppercase tracking-widest">
                        {social.label}
                      </label>
                      {String(settings[social.id] || "").trim() && <Badge variant="success" size="sm" className="me-auto rounded-full text-[9px]">مفعل</Badge>}
                    </div>
                    <Input
                      id={social.id}
                      value={String(settings[social.id] ?? "")}
                      onChange={(e) => updateField(social.id, e.target.value)}
                      className="h-11 bg-soft border-border font-bold rounded-xl ltr"
                      placeholder={`https://${social.label.toLowerCase()}.com/...`}
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            </PremiumCard>
          </motion.div>
        )}
        {activeSubTab === "extras" && (
          <motion.div
            key="extras"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard className="space-y-6">
              <SectionGroup title="الشارات والعناوين العلوية (Eyebrow)" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    ["landingPublicHeaderBadge", "شارة الهيدر العلوي"],
                    ["landingHeroHighlightBadge", "شارة تمييز الهيرو"],
                    ["landingServicesEyebrow", "تمهيد الخدمات"],
                    ["landingPortfolioEyebrow", "تمهيد المعرض"],
                    ["landingBookingEyebrow", "تمهيد الحجز"],
                    ["landingLocationEyebrow", "تمهيد الموقع"],
                    ["landingContactEyebrow", "تمهيد التواصل"],
                    ["landingTestimonialsEyebrow", "تمهيد الشهادات"],
                    ["landingQuickActionsEyebrow", "تمهيد الإجراءات السريعة"],
                  ] as [string, string][]
                ).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">{label}</label>
                    <Input
                      value={String(settings[key] ?? "")}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="h-11 bg-soft border-border font-bold rounded-xl"
                      placeholder={label}
                    />
                  </div>
                ))}
              </div>
            </PremiumCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PremiumCard className="space-y-5">
                <SectionGroup title="تمييز الهيرو والدعوة" />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">عنوان تمييز الهيرو</label>
                    <Input value={String(settings.landingHeroHighlightTitle ?? "")} onChange={(e) => updateField("landingHeroHighlightTitle", e.target.value)} className="h-11 bg-soft border-border font-black rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">وصف تمييز الهيرو</label>
                    <textarea value={String(settings.landingHeroHighlightSubtitle ?? "")} onChange={(e) => updateField("landingHeroHighlightSubtitle", e.target.value)} className="w-full min-h-[80px] rounded-xl bg-soft border border-border p-3 text-xs font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">عنوان الشهادات</label>
                      <Input value={String(settings.landingTestimonialsTitle ?? "")} onChange={(e) => updateField("landingTestimonialsTitle", e.target.value)} className="h-11 bg-soft border-border font-bold rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">وصف الشهادات</label>
                      <textarea value={String(settings.landingTestimonialsSubtitle ?? "")} onChange={(e) => updateField("landingTestimonialsSubtitle", e.target.value)} className="w-full min-h-[70px] rounded-xl bg-soft border border-border p-3 text-xs font-bold outline-none focus:border-primary" />
                    </div>
                  </div>
                </div>
              </PremiumCard>

              <PremiumCard className="space-y-5">
                <SectionGroup title="الموقع الجغرافي التفصيلي" />
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">وصف الموقع</label>
                    <textarea value={String(settings.landingLocationDescription ?? "")} onChange={(e) => updateField("landingLocationDescription", e.target.value)} className="w-full min-h-[80px] rounded-xl bg-soft border border-border p-3 text-xs font-bold outline-none focus:border-primary" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">نص «مفتوح»</label>
                      <Input value={String(settings.landingLocationOpenLabel ?? "")} onChange={(e) => updateField("landingLocationOpenLabel", e.target.value)} className="h-11 bg-soft border-border font-bold rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">نص «مغلق»</label>
                      <Input value={String(settings.landingLocationClosedLabel ?? "")} onChange={(e) => updateField("landingLocationClosedLabel", e.target.value)} className="h-11 bg-soft border-border font-bold rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">نص حالة الموقع</label>
                    <Input value={String(settings.landingLocationStatusText ?? "")} onChange={(e) => updateField("landingLocationStatusText", e.target.value)} className="h-11 bg-soft border-border font-bold rounded-xl" />
                  </div>
                </div>
              </PremiumCard>
            </div>

            <PremiumCard className="space-y-5">
              <SectionGroup title="التواصل والإجراءات والختام" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">وصف التواصل</label>
                  <textarea value={String(settings.landingContactSubtitle ?? "")} onChange={(e) => updateField("landingContactSubtitle", e.target.value)} className="w-full min-h-[70px] rounded-xl bg-soft border border-border p-3 text-xs font-bold outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">وصف الإجراءات السريعة</label>
                  <textarea value={String(settings.landingQuickActionsSubtitle ?? "")} onChange={(e) => updateField("landingQuickActionsSubtitle", e.target.value)} className="w-full min-h-[70px] rounded-xl bg-soft border border-border p-3 text-xs font-bold outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">عنوان الإجراءات السريعة</label>
                  <Input value={String(settings.landingQuickActionsTitle ?? "")} onChange={(e) => updateField("landingQuickActionsTitle", e.target.value)} className="h-11 bg-soft border-border font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">زر الختام</label>
                  <Input value={String(settings.landingFinalButtonLabel ?? "")} onChange={(e) => updateField("landingFinalButtonLabel", e.target.value)} className="h-11 bg-soft border-border font-black rounded-xl" placeholder="مثلاً: احجز الآن" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">عنوان الختام</label>
                  <Input value={String(settings.landingFinalTitle ?? "")} onChange={(e) => updateField("landingFinalTitle", e.target.value)} className="h-11 bg-soft border-border font-bold rounded-xl" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">وصف الختام</label>
                  <textarea value={String(settings.landingFinalSubtitle ?? "")} onChange={(e) => updateField("landingFinalSubtitle", e.target.value)} className="w-full min-h-[80px] rounded-xl bg-soft border border-border p-3 text-xs font-bold outline-none focus:border-primary" />
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        )}
        {activeSubTab === "design" && (
          <motion.div
            key="design"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <PremiumCard className="space-y-8">
              <SectionGroup title="هوية الموقع" />
              <p className="-mt-2 text-xs font-bold leading-relaxed text-muted">
                اللون النشط يبقى ثابتاً كما هو. الخلفية فقط هي التي تتغيّر عندما
                يختار الزائر الوضع الفاتح أو الداكن — ولهذا يأتي الخياران في كل
                لون متشابهين.
              </p>

              <div className="space-y-7">
                {SITE_PALETTES.map((brand) => (
                  <div key={brand.brand} className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <h5 className="text-xs font-black text-main">
                        {brand.brandLabel}
                      </h5>
                      <span className="text-[11px] font-bold text-muted">
                        {brand.brandNote}
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {brand.options.map((option) => {
                        const active =
                          String(settings.landingThemeId || "") === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              updateField("landingThemeId", option.id)
                            }
                            aria-pressed={active}
                            className={`group overflow-hidden rounded-2xl border-2 text-start transition-all duration-200 ${
                              active
                                ? "border-primary shadow-md"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {/*
                              A miniature of the real thing: the ground, a
                              raised surface, the signal used once for a
                              headline and once for an action. Showing literal
                              swatches would not tell the owner what the page
                              will feel like.
                            */}
                            <span
                              className="flex h-28 flex-col justify-between p-4"
                              style={{ backgroundColor: option.bg }}
                            >
                              <span className="flex items-center justify-between">
                                <span
                                  className="h-2 w-14 rounded-full"
                                  style={{ backgroundColor: option.accent }}
                                />
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor: option.accent,
                                    opacity: 0.35,
                                  }}
                                />
                              </span>
                              <span className="space-y-2">
                                <span
                                  className="block h-2.5 w-3/4 rounded-full"
                                  style={{
                                    backgroundColor: option.card,
                                    opacity: 0.9,
                                  }}
                                />
                                <span
                                  className="block h-6 w-24 rounded-lg"
                                  style={{ backgroundColor: option.accent }}
                                />
                              </span>
                            </span>

                            <span className="flex items-center justify-between gap-2 border-t border-border bg-card px-4 py-3">
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-black text-main">
                                  {option.label}
                                </span>
                                <span className="block truncate text-[10px] font-bold text-muted">
                                  {option.note}
                                </span>
                              </span>
                              {active ? (
                                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-white">
                                  <Check size={12} />
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </PremiumCard>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PremiumCard className="space-y-5">
                <SectionGroup title="أقسام اختيارية" />
                <div className="space-y-4">
                  {(
                    [
                      [
                        "landingShowStaff",
                        "إظهار قسم الفريق",
                        "يظهر اسم الحلاقين وصورهم إن كان لديك فريق.",
                      ],
                      [
                        "landingShowStaffBio",
                        "إظهار نبذة الحلاق",
                        "يعرض الوصف إلى جانب الاسم والمسمّى.",
                      ],
                    ] as [string, string, string][]
                  ).map(([key, label, hint]) => (
                    <label
                      key={key}
                      htmlFor={`website-${key}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-soft/40 p-4 transition-colors hover:border-primary/30"
                    >
                      <input
                        id={`website-${key}`}
                        type="checkbox"
                        checked={Boolean(settings[key])}
                        onChange={(e) => updateField(key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-black text-main">
                          {label}
                        </span>
                        <span className="block text-[11px] font-bold text-muted">
                          {hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </PremiumCard>

              <PremiumCard className="space-y-5">
                <SectionGroup title="شارة الهيدر العلوي" />
                <div className="space-y-2">
                  <label
                    htmlFor="public-header-badge"
                    className="text-[10px] font-black text-muted uppercase tracking-widest"
                  >
                    نص الشارة
                  </label>
                  <Input
                    id="public-header-badge"
                    value={String(
                      settings.landingPublicHeaderBadge ?? "",
                    )}
                    onChange={(e) =>
                      updateField("landingPublicHeaderBadge", e.target.value)
                    }
                    className="h-11 rounded-xl border-border bg-soft font-bold"
                    placeholder="اتركه فارغاً لإخفائه"
                  />
                  <p className="text-[11px] font-bold text-muted">
                    يظهر أعلى ترويسة الموقع. اتركه فارغاً لإخفاء الشارة بالكامل.
                  </p>
                </div>
              </PremiumCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold text-muted">التغييرات تُحفظ كمسودة حتى الضغط على الحفظ.</p>
          {hasUnsaved && !saving && <Badge variant="warning" className="rounded-full text-[10px] font-black">تعديلات غير محفوظة</Badge>}
          {!hasUnsaved && !loading && <Badge variant="secondary" className="rounded-full text-[10px]">محفوظ</Badge>}
        </div>
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          loading={saving}
          className="h-12 rounded-xl px-8 font-black text-xs shadow-md disabled:opacity-60"
        >
          <Save size={16} className="ms-2" /> {saving ? "جاري الحفظ..." : "حفظ إعدادات الموقع"}
        </Button>
      </div>
    </div>
  );
};

export default WebsiteSettingsPanel;

function SectionGroup({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-primary" />
        <h4 className="text-xs font-black uppercase tracking-widest text-main">{title}</h4>
      </div>
      {children}
    </div>
  );
}
