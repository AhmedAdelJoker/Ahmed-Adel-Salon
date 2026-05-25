import { useEffect, useState } from "react";
import {
  Globe,
  Layout,
  Image as ImageIcon,
  Share2,
  Plus,
  Trash2,
  Save,
  Activity,
  Facebook,
  Instagram,
  Youtube,
  Music2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import { adaptObject } from "../../services/apiAdapter";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildLandingSiteContent,
  DEFAULT_LANDING_COPY,
  DEFAULT_LANDING_FEATURES,
  DEFAULT_LANDING_STATS,
  DEFAULT_LANDING_TESTIMONIALS,
  DEFAULT_TRUST_BADGES,
} from "../../lib/publicSiteContent";

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : import.meta.env.VITE_API_URL;

const SUB_TABS = [
  {
    id: "content",
    label: "المحتوى",
    icon: Layout,
    description: "العنوان الرئيسي، وصف الصفحة، وقسم من نحن.",
  },
  {
    id: "sections",
    label: "الأقسام",
    icon: Globe,
    description: "عناوين الأقسام، بطاقات الإحصاءات، وشارات الثقة.",
  },
  {
    id: "portfolio",
    label: "المعرض",
    icon: ImageIcon,
    description: "صورة الغلاف الرئيسية وصور المعرض التي تظهر للعملاء.",
  },
  {
    id: "social",
    label: "التواصل",
    icon: Share2,
    description: "روابط السوشيال التي تظهر في صفحة العميل.",
  },
];

const WebsiteSettingsPanel = ({ onSaved, onChangeDraft }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("content");

  const [settings, setSettings] = useState({
    landingHeroTitle: "",
    landingHeroSubtitle: "",
    landingAboutTitle: "",
    landingAboutContent: "",
    landingHeroBadge: "",
    landingServicesEyebrow: DEFAULT_LANDING_COPY.landingServicesEyebrow,
    landingServicesTitle: DEFAULT_LANDING_COPY.landingServicesTitle,
    landingServicesSubtitle: DEFAULT_LANDING_COPY.landingServicesSubtitle,
    landingPortfolioEyebrow: DEFAULT_LANDING_COPY.landingPortfolioEyebrow,
    landingPortfolioTitle: DEFAULT_LANDING_COPY.landingPortfolioTitle,
    landingBookingEyebrow: DEFAULT_LANDING_COPY.landingBookingEyebrow,
    landingBookingTitle: DEFAULT_LANDING_COPY.landingBookingTitle,
    landingBookingSubtitle: DEFAULT_LANDING_COPY.landingBookingSubtitle,
    landingLocationEyebrow: DEFAULT_LANDING_COPY.landingLocationEyebrow,
    landingLocationTitle: DEFAULT_LANDING_COPY.landingLocationTitle,
    landingLocationDescription: DEFAULT_LANDING_COPY.landingLocationDescription,
    landingLocationOpenLabel: DEFAULT_LANDING_COPY.landingLocationOpenLabel,
    landingLocationClosedLabel: DEFAULT_LANDING_COPY.landingLocationClosedLabel,
    landingLocationStatusText: DEFAULT_LANDING_COPY.landingLocationStatusText,
    landingContactEyebrow: DEFAULT_LANDING_COPY.landingContactEyebrow,
    landingContactTitle: DEFAULT_LANDING_COPY.landingContactTitle,
    landingContactSubtitle: DEFAULT_LANDING_COPY.landingContactSubtitle,
    landingQuickActionsEyebrow: DEFAULT_LANDING_COPY.landingQuickActionsEyebrow,
    landingQuickActionsTitle: DEFAULT_LANDING_COPY.landingQuickActionsTitle,
    landingQuickActionsSubtitle:
      DEFAULT_LANDING_COPY.landingQuickActionsSubtitle,
    landingFinalTitle: DEFAULT_LANDING_COPY.landingFinalTitle,
    landingFinalSubtitle: DEFAULT_LANDING_COPY.landingFinalSubtitle,
    landingFinalButtonLabel: DEFAULT_LANDING_COPY.landingFinalButtonLabel,
    landingHeroHighlightTitle: DEFAULT_LANDING_COPY.landingHeroHighlightTitle,
    landingHeroHighlightSubtitle:
      DEFAULT_LANDING_COPY.landingHeroHighlightSubtitle,
    landingHeroHighlightBadge: DEFAULT_LANDING_COPY.landingHeroHighlightBadge,
    landingThemeId: "gold",
    landingShowStaff: true,
    landingShowStaffBio: true,
    landingPublicHeaderBadge: DEFAULT_LANDING_COPY.landingPublicHeaderBadge,
    landingCoverImageUrl: "",
    landingTestimonialsEyebrow: DEFAULT_LANDING_COPY.landingTestimonialsEyebrow,
    landingTestimonialsTitle: DEFAULT_LANDING_COPY.landingTestimonialsTitle,
    landingTestimonialsSubtitle:
      DEFAULT_LANDING_COPY.landingTestimonialsSubtitle,
    landingStats: DEFAULT_LANDING_STATS,
    landingFeatures: DEFAULT_LANDING_FEATURES,
    landingTrustBadges: DEFAULT_TRUST_BADGES.map((label) => ({ label })),
    landingTestimonials: DEFAULT_LANDING_TESTIMONIALS,
    landingPortfolio: [],
    socialFacebook: "",
    socialInstagram: "",
    socialTiktok: "",
    socialYoutube: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const settingsRes = await api.get("/business-settings");
      const settingsData = adaptObject(settingsRes, {});
      const content = buildLandingSiteContent(settingsData);
      setSettings({
        landingHeroTitle: settingsData.landingHeroTitle || "",
        landingHeroSubtitle: settingsData.landingHeroSubtitle || "",
        landingAboutTitle: settingsData.landingAboutTitle || "",
        landingAboutContent: settingsData.landingAboutContent || "",
        landingHeroBadge:
          settingsData.landingHeroBadge || content.copy.landingHeroBadge,
        landingServicesEyebrow: content.copy.landingServicesEyebrow,
        landingServicesTitle: content.copy.landingServicesTitle,
        landingServicesSubtitle: content.copy.landingServicesSubtitle,
        landingPortfolioEyebrow: content.copy.landingPortfolioEyebrow,
        landingPortfolioTitle: content.copy.landingPortfolioTitle,
        landingBookingEyebrow: content.copy.landingBookingEyebrow,
        landingBookingTitle: content.copy.landingBookingTitle,
        landingBookingSubtitle: content.copy.landingBookingSubtitle,
        landingLocationEyebrow: content.copy.landingLocationEyebrow,
        landingLocationTitle: content.copy.landingLocationTitle,
        landingLocationDescription: content.copy.landingLocationDescription,
        landingLocationOpenLabel: content.copy.landingLocationOpenLabel,
        landingLocationClosedLabel: content.copy.landingLocationClosedLabel,
        landingLocationStatusText: content.copy.landingLocationStatusText,
        landingContactEyebrow: content.copy.landingContactEyebrow,
        landingContactTitle: content.copy.landingContactTitle,
        landingContactSubtitle: content.copy.landingContactSubtitle,
        landingQuickActionsEyebrow: content.copy.landingQuickActionsEyebrow,
        landingQuickActionsTitle: content.copy.landingQuickActionsTitle,
        landingQuickActionsSubtitle: content.copy.landingQuickActionsSubtitle,
        landingFinalTitle: content.copy.landingFinalTitle,
        landingFinalSubtitle: content.copy.landingFinalSubtitle,
        landingFinalButtonLabel: content.copy.landingFinalButtonLabel,
        landingHeroHighlightTitle: content.copy.landingHeroHighlightTitle,
        landingHeroHighlightSubtitle: content.copy.landingHeroHighlightSubtitle,
        landingHeroHighlightBadge: content.copy.landingHeroHighlightBadge,
        landingPublicHeaderBadge: content.copy.landingPublicHeaderBadge,
        landingCoverImageUrl:
          settingsData.landingCoverImageUrl ||
          settingsData.landing_cover_image_url ||
          "",
        landingTestimonialsEyebrow: content.copy.landingTestimonialsEyebrow,
        landingTestimonialsTitle: content.copy.landingTestimonialsTitle,
        landingTestimonialsSubtitle: content.copy.landingTestimonialsSubtitle,
        landingStats: content.stats,
        landingFeatures: content.features,
        landingTrustBadges: content.trustBadges.map((label) => ({ label })),
        landingTestimonials: content.testimonials,
        landingPortfolio: settingsData.landingPortfolio || [],
        socialFacebook: settingsData.socialFacebook || "",
        socialInstagram: settingsData.socialInstagram || "",
        socialTiktok: settingsData.socialTiktok || "",
        socialYoutube: settingsData.socialYoutube || "",
      });
    } catch (err) {
      toast.error("فشل تحميل إعدادات الموقع");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/business-settings", settings);
      toast.success("تم حفظ إعدادات الموقع بنجاح");
      onSaved?.();
    } catch (err) {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPortfolioImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading("جاري رفع الصورة...", { id: "upload" });
      const res = await api.post("/business-settings/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {});
      const newUrl = data.url;

      setSettings((prev) => ({
        ...prev,
        landingPortfolio: [...prev.landingPortfolio, newUrl],
      }));
      toast.success("تم إضافة الصورة للمعرض", { id: "upload" });
    } catch (err) {
      toast.error("فشل رفع الصورة", { id: "upload" });
    } finally {
      e.target.value = "";
    }
  };

  const handleCoverImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading("جاري رفع صورة الغلاف...", { id: "cover-upload" });
      const res = await api.post("/business-settings/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {});

      setSettings((prev) => ({
        ...prev,
        landingCoverImageUrl: data.url || "",
      }));
      toast.success("تم تحديث صورة الغلاف", { id: "cover-upload" });
    } catch (err) {
      toast.error("فشل رفع صورة الغلاف", { id: "cover-upload" });
    } finally {
      e.target.value = "";
    }
  };

  const removeCoverImage = () => {
    setSettings((prev) => ({
      ...prev,
      landingCoverImageUrl: "",
    }));
  };

  const removePortfolioImage = (index) => {
    setSettings((prev) => ({
      ...prev,
      landingPortfolio: prev.landingPortfolio.filter((_, i) => i !== index),
    }));
  };

  const updateArrayItem = (key, index, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: prev[key].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const activeTabMeta =
    SUB_TABS.find((tab) => tab.id === activeSubTab) || SUB_TABS[0];
  const ActiveTabIcon = activeTabMeta.icon;
  const overviewCards = [
    {
      label: "العرض الرئيسي",
      value: settings.landingCoverImageUrl ? "غلاف جاهز" : "بدون غلاف",
      hint: settings.landingCoverImageUrl
        ? "صورة مستقلة للواجهة الرئيسية"
        : "ارفع صورة Hero مستقلة للموقع",
    },
    {
      label: "المعرض",
      value: `${settings.landingPortfolio.length}`,
      hint: "عدد الصور الحالية في صفحة العميل",
    },
    {
      label: "روابط التواصل",
      value: `${
        [
          settings.socialFacebook,
          settings.socialInstagram,
          settings.socialTiktok,
          settings.socialYoutube,
        ].filter(Boolean).length
      }/4`,
      hint: "عدد القنوات المفعلة حاليًا",
    },
    {
      label: "شارات الثقة",
      value: `${settings.landingTrustBadges.filter((item) => item.label).length}/3`,
      hint: "النصوص المختصرة أسفل الصفحة",
    },
    {
      label: "التقييمات",
      value: `${settings.landingTestimonials.filter((item) => item.quote).length}/3`,
      hint: "عدد شهادات العملاء المفعلة",
    },
  ];

  useEffect(() => {
    onChangeDraft?.(settings);
  }, [onChangeDraft, settings]);

  if (loading)
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Activity className="w-10 h-10 animate-pulse text-accent" />
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-border bg-card p-5 shadow-soft"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
              {item.label}
            </p>
            <h4 className="mt-3 text-xl font-black text-main">{item.value}</h4>
            <p className="mt-2 text-sm font-bold text-muted">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-main flex items-center gap-2">
            <Globe size={18} className="text-accent" /> إدارة الموقع الإلكتروني
          </h3>
          <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">
            التحكم في المحتوى العام والهوية الرقمية للموقع
          </p>
        </div>
        <div className="flex bg-soft p-1 rounded-xl border border-border">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              disabled={loading}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${
                activeSubTab === tab.id
                  ? "bg-card text-accent shadow-sm"
                  : "text-muted hover:text-main"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-soft/40 px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
          القسم الحالي
        </p>
        <div className="mt-2 flex items-center gap-3">
          <ActiveTabIcon size={18} className="text-accent" />
          <h4 className="text-lg font-black text-main">
            {activeTabMeta.label}
          </h4>
        </div>
        <p className="mt-2 text-sm font-bold text-muted">
          {activeTabMeta.description}
        </p>
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
            <Card className="p-8 border-border bg-card shadow-soft space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-6 bg-accent rounded-full" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-main">
                      القسم الرئيسي (Hero)
                    </h4>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        شارة أعلى الصفحة
                      </label>
                      <Input
                        value={settings.landingHeroBadge || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            landingHeroBadge: e.target.value,
                          })
                        }
                        className="h-12 bg-soft border-border font-bold"
                        placeholder="اسم أو وصف قصير أعلى البطل"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        العنوان الجذاب
                      </label>
                      <Input
                        value={settings.landingHeroTitle || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            landingHeroTitle: e.target.value,
                          })
                        }
                        className="h-12 bg-soft border-border font-bold"
                        placeholder="ارتقِ بمظهرك إلى مستوى الاحتراف"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        الوصف الفرعي
                      </label>
                      <textarea
                        value={settings.landingHeroSubtitle || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            landingHeroSubtitle: e.target.value,
                          })
                        }
                        className="w-full min-h-[100px] rounded-xl bg-soft border border-border p-4 text-sm font-bold outline-none focus:border-accent"
                        placeholder="تجربة حلاقة فاخرة تجمع بين الدقة، الفن، والراحة..."
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-6 bg-accent rounded-full" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-main">
                      قسم من نحن (About)
                    </h4>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        عنوان القسم
                      </label>
                      <Input
                        value={settings.landingAboutTitle || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            landingAboutTitle: e.target.value,
                          })
                        }
                        className="h-12 bg-soft border-border font-bold"
                        placeholder="قصتنا في عالم الحلاقة"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        المحتوى
                      </label>
                      <textarea
                        value={settings.landingAboutContent || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            landingAboutContent: e.target.value,
                          })
                        }
                        className="w-full min-h-[100px] rounded-xl bg-soft border border-border p-4 text-sm font-bold outline-none focus:border-accent"
                        placeholder="بدأنا بشغف الحلاقة الكلاسيكية وطورناها لتناسب العصر الحديث..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
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
            <Card className="p-8 border-border bg-card shadow-soft space-y-8">
              <SectionGroup title="الإحصاءات الرئيسية">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {settings.landingStats.map((item, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-border bg-soft/60 p-4"
                    >
                      <Input
                        value={item.value || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingStats",
                            index,
                            "value",
                            e.target.value,
                          )
                        }
                        className="h-12 bg-white/70 border-border font-black"
                        placeholder="القيمة"
                      />
                      <Input
                        value={item.label || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingStats",
                            index,
                            "label",
                            e.target.value,
                          )
                        }
                        className="h-12 bg-white/70 border-border font-bold"
                        placeholder="العنوان"
                      />
                      <textarea
                        value={item.description || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingStats",
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        className="min-h-[90px] w-full rounded-xl border border-border bg-white/70 p-4 text-sm font-bold outline-none focus:border-accent"
                        placeholder="الوصف القصير"
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="بطاقات عن المحل">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {settings.landingFeatures.map((item, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-border bg-soft/60 p-4"
                    >
                      <Input
                        value={item.title || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingFeatures",
                            index,
                            "title",
                            e.target.value,
                          )
                        }
                        className="h-12 bg-white/70 border-border font-black"
                        placeholder="عنوان البطاقة"
                      />
                      <textarea
                        value={item.description || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingFeatures",
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        className="min-h-[120px] w-full rounded-xl border border-border bg-white/70 p-4 text-sm font-bold outline-none focus:border-accent"
                        placeholder="وصف البطاقة"
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="عناوين ونصوص الأقسام">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[
                    ["landingServicesEyebrow", "شارة قسم الخدمات"],
                    ["landingServicesTitle", "عنوان الخدمات"],
                    ["landingServicesSubtitle", "وصف الخدمات", true],
                    ["landingPortfolioEyebrow", "شارة قسم المعرض"],
                    ["landingPortfolioTitle", "عنوان المعرض"],
                    ["landingBookingEyebrow", "شارة قسم الحجز"],
                    ["landingBookingTitle", "عنوان الحجز"],
                    ["landingBookingSubtitle", "وصف الحجز", true],
                    ["landingLocationEyebrow", "شارة قسم الموقع"],
                    ["landingLocationTitle", "عنوان الموقع"],
                    ["landingLocationDescription", "وصف الموقع", true],
                    ["landingContactEyebrow", "شارة قسم التواصل"],
                    ["landingContactTitle", "عنوان التواصل"],
                    ["landingContactSubtitle", "وصف التواصل", true],
                    ["landingQuickActionsEyebrow", "شارة الإجراءات السريعة"],
                    ["landingQuickActionsTitle", "عنوان الإجراءات السريعة"],
                    ["landingQuickActionsSubtitle", "وصف الإجراءات", true],
                    ["landingFinalTitle", "عنوان الختام"],
                    ["landingFinalSubtitle", "وصف الختام", true],
                    ["landingFinalButtonLabel", "نص زر الختام"],
                    [
                      "landingHeroHighlightTitle",
                      "عنوان بطاقة الصورة الرئيسية",
                    ],
                    [
                      "landingHeroHighlightSubtitle",
                      "وصف بطاقة الصورة الرئيسية",
                      true,
                    ],
                    ["landingHeroHighlightBadge", "شارة بطاقة الصورة الرئيسية"],
                    ["landingPublicHeaderBadge", "شارة رأس الصفحة"],
                    ["landingTestimonialsEyebrow", "شارة قسم التقييمات"],
                    ["landingTestimonialsTitle", "عنوان التقييمات"],
                    ["landingTestimonialsSubtitle", "وصف التقييمات", true],
                    ["landingLocationOpenLabel", "نص حالة الفتح"],
                    ["landingLocationClosedLabel", "نص حالة الإغلاق"],
                    ["landingLocationStatusText", "وصف حالة الموقع"],
                  ].map(([key, label, multiline]) => (
                    <div key={key} className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-1">
                        {label}
                      </label>
                      {multiline ? (
                        <textarea
                          value={settings[key] || ""}
                          onChange={(e) =>
                            setSettings({ ...settings, [key]: e.target.value })
                          }
                          className="min-h-[100px] w-full rounded-xl border border-border bg-soft p-4 text-sm font-bold outline-none focus:border-accent"
                        />
                      ) : (
                        <Input
                          value={settings[key] || ""}
                          onChange={(e) =>
                            setSettings({ ...settings, [key]: e.target.value })
                          }
                          className="h-12 bg-soft border-border font-bold"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="إدارة الهوية البصرية وفريق العمل">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-1 rounded-full bg-[#d3a15c]" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-main">
                        التحكم في ظهور الفريق
                      </h4>
                    </div>
                    <div className="p-6 rounded-2xl bg-soft/50 border border-border/60 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-main">
                            إظهار فريق العمل
                          </p>
                          <p className="text-[10px] font-medium text-muted">
                            تفعيل قسم الحلاقين المتميزين في الموقع
                          </p>
                        </div>
                        <Switch
                          checked={settings.landingShowStaff ?? true}
                          onCheckedChange={(v) =>
                            setSettings({ ...settings, landingShowStaff: v })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-border/40">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-main">
                            عرض السير الذاتية
                          </p>
                          <p className="text-[10px] font-medium text-muted">
                            إظهار النبذة المهنية لكل حلاق
                          </p>
                        </div>
                        <Switch
                          checked={settings.landingShowStaffBio ?? true}
                          onCheckedChange={(v) =>
                            setSettings({ ...settings, landingShowStaffBio: v })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-1 rounded-full bg-[#d3a15c]" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-main">
                        نمط التصميم (Theme)
                      </h4>
                    </div>
                    <div className="p-6 rounded-2xl bg-[#1B1714] border border-white/5 space-y-5">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          {
                            id: "gold",
                            label: "Luxe Gold",
                            color: "bg-[#d3a15c]",
                          },
                          {
                            id: "silver",
                            label: "Modern Silver",
                            color: "bg-slate-300",
                          },
                          {
                            id: "black",
                            label: "Classic Black",
                            color: "bg-black",
                          },
                        ].map((theme) => (
                          <button
                            key={theme.id}
                            onClick={() =>
                              setSettings({
                                ...settings,
                                landingThemeId: theme.id,
                              })
                            }
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.landingThemeId === theme.id ? "border-[#d3a15c] bg-white/5" : "border-white/5 bg-transparent opacity-40 hover:opacity-100"}`}
                          >
                            <div
                              className={`h-6 w-6 rounded-full shadow-lg ${theme.color}`}
                            />
                            <span className="text-[8px] font-black text-white uppercase">
                              {theme.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionGroup>

              <SectionGroup title="شارات الثقة السفلية">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {settings.landingTrustBadges.map((item, index) => (
                    <Input
                      key={index}
                      value={item.label || ""}
                      onChange={(e) =>
                        updateArrayItem(
                          "landingTrustBadges",
                          index,
                          "label",
                          e.target.value,
                        )
                      }
                      className="h-12 bg-soft border-border font-bold"
                      placeholder={`الشارة ${index + 1}`}
                    />
                  ))}
                </div>
              </SectionGroup>

              <SectionGroup title="آراء العملاء">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {settings.landingTestimonials.map((item, index) => (
                    <div
                      key={index}
                      className="space-y-3 rounded-2xl border border-border bg-soft/60 p-4"
                    >
                      <Input
                        value={item.name || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingTestimonials",
                            index,
                            "name",
                            e.target.value,
                          )
                        }
                        className="h-12 bg-white/70 border-border font-black"
                        placeholder="اسم العميل"
                      />
                      <Input
                        value={item.role || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingTestimonials",
                            index,
                            "role",
                            e.target.value,
                          )
                        }
                        className="h-12 bg-white/70 border-border font-bold"
                        placeholder="وصف مختصر"
                      />
                      <textarea
                        value={item.quote || ""}
                        onChange={(e) =>
                          updateArrayItem(
                            "landingTestimonials",
                            index,
                            "quote",
                            e.target.value,
                          )
                        }
                        className="min-h-[120px] w-full rounded-xl border border-border bg-white/70 p-4 text-sm font-bold outline-none focus:border-accent"
                        placeholder="رأي العميل"
                      />
                    </div>
                  ))}
                </div>
              </SectionGroup>
            </Card>
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
            <Card className="space-y-8 border-border bg-card p-8 shadow-soft">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-4 rounded-3xl border border-border bg-soft/50 p-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
                      صورة الغلاف
                    </p>
                    <h4 className="mt-3 text-lg font-black text-main">
                      الواجهة الرئيسية للموقع
                    </h4>
                    <p className="mt-2 text-sm font-bold leading-7 text-muted">
                      هذه الصورة تظهر في أول الشاشة داخل صفحة المحل، وهي مستقلة
                      عن صور المعرض ويمكن تغييرها بدون التأثير على بقية الصور.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="btn btn-primary h-10 cursor-pointer px-6 text-[10px]">
                      <Plus size={16} className="ml-2" />
                      {settings.landingCoverImageUrl
                        ? "استبدال الغلاف"
                        : "رفع الغلاف"}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                      />
                    </label>
                    {settings.landingCoverImageUrl ? (
                      <button
                        type="button"
                        onClick={removeCoverImage}
                        className="btn h-10 border border-danger/30 bg-danger/10 px-5 text-[10px] font-black text-danger transition hover:bg-danger/20"
                      >
                        <Trash2 size={16} className="ml-2" />
                        حذف الغلاف
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[2rem] border border-border bg-soft">
                  {settings.landingCoverImageUrl ? (
                    <img
                      src={
                        settings.landingCoverImageUrl.startsWith("http")
                          ? settings.landingCoverImageUrl
                          : `${STATIC_URL}${settings.landingCoverImageUrl}`
                      }
                      alt="Cover"
                      className="h-[280px] w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-[280px] flex-col items-center justify-center gap-4 text-muted">
                      <ImageIcon size={42} className="opacity-25" />
                      <p className="text-sm font-bold">
                        لا توجد صورة غلاف مستقلة حتى الآن
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs font-bold text-muted">
                صور المعرض بالأسفل مخصّصة لقسم الأعمال فقط. لم نعد نعتمد على أول
                صورة منها كغلاف تلقائي، إلا إذا لم تضف صورة غلاف مستقلة.
              </div>

              <div className="flex items-center justify-between mb-8">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-main">
                    معرض الأعمال
                  </h4>
                  <p className="text-[9px] font-bold text-muted mt-1 uppercase tracking-wider">
                    الصور التي تظهر للعملاء كأمثلة على شغلك
                  </p>
                </div>
                <label className="btn btn-primary h-10 px-6 text-[10px] cursor-pointer">
                  <Plus size={16} className="ml-2" /> إضافة صورة
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAddPortfolioImage}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {settings.landingPortfolio.map((url, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-border bg-soft"
                  >
                    <img
                      src={url.startsWith("http") ? url : `${STATIC_URL}${url}`}
                      alt={`Portfolio ${idx}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        disabled={loading}
                        onClick={() => removePortfolioImage(idx)}
                        className="h-10 w-10 rounded-full bg-danger text-white flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {settings.landingPortfolio.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted border-2 border-dashed border-border rounded-3xl">
                    <ImageIcon size={48} className="opacity-20 mb-4" />
                    <p className="text-xs font-bold">
                      لا توجد صور في المعرض حالياً
                    </p>
                  </div>
                )}
              </div>
            </Card>
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
            <Card className="p-8 border-border bg-card shadow-soft">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  {
                    id: "socialFacebook",
                    label: "Facebook",
                    icon: Facebook,
                    color: "text-blue-600",
                  },
                  {
                    id: "socialInstagram",
                    label: "Instagram",
                    icon: Instagram,
                    color: "text-pink-600",
                  },
                  {
                    id: "socialTiktok",
                    label: "TikTok",
                    icon: Music2,
                    color: "text-black",
                  },
                  {
                    id: "socialYoutube",
                    label: "YouTube",
                    icon: Youtube,
                    color: "text-red-600",
                  },
                ].map((social) => (
                  <div key={social.id} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <social.icon size={16} className={social.color} />
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                        {social.label}
                      </label>
                    </div>
                    <Input
                      value={settings[social.id] || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [social.id]: e.target.value,
                        })
                      }
                      className="h-12 bg-soft border-border font-bold"
                      placeholder={`رابط حساب ${social.label}`}
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          variant="accent"
          className="px-16 h-14 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-soft hover:-translate-y-0.5 transition-all"
        >
          {saving ? "جاري الحفظ..." : "تأكيد بروتوكول الموقع"}{" "}
          <Save className="mr-2" size={16} />
        </Button>
      </div>
    </div>
  );
};

export default WebsiteSettingsPanel;

function SectionGroup({ title, children }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-6 w-1 rounded-full bg-accent" />
        <h4 className="text-xs font-black uppercase tracking-widest text-main">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
