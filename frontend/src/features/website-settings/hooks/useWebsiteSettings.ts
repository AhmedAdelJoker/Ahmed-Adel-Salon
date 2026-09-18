import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { adaptObject } from "@/services/apiAdapter";
import type { BusinessSettings, SettingsState } from "@/types/website";
import {
  buildLandingSiteContent,
  DEFAULT_LANDING_COPY,
  DEFAULT_LANDING_FEATURES,
  DEFAULT_LANDING_STATS,
  DEFAULT_LANDING_TESTIMONIALS,
  DEFAULT_TRUST_BADGES,
} from "@/lib/site/content";
import { validateImageSize } from "@/lib/media/upload";

const SUB_TABS = [
  {
    id: "content",
    label: "المحتوى",
    description: "العنوان الرئيسي، وصف الصفحة، وقسم من نحن.",
  },
  {
    id: "sections",
    label: "الأقسام",
    description: "عناوين الأقسام، بطاقات الإحصاءات، وشارات الثقة.",
  },
  {
    id: "portfolio",
    label: "المعرض",
    description: "صورة الغلاف الرئيسية وصور المعرض التي تظهر للعملاء.",
  },
  {
    id: "social",
    label: "التواصل",
    description: "روابط السوشيال التي تظهر في صفحة العميل.",
  },
  {
    id: "extras",
    label: "نصوص إضافية",
    description: "النصوص الدقيقة للأقسام المتقدمة والختام.",
  },
];

interface UseWebsiteSettingsProps {
  onSaved?: () => void;
  onChangeDraft?: (settings: SettingsState) => void;
}

export function useWebsiteSettings({ onSaved, onChangeDraft }: UseWebsiteSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("content");

  const [settings, setSettings] = useState<SettingsState>({
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const settingsRes = await api.get("/business-settings");
      const settingsData = adaptObject(settingsRes, {}) as BusinessSettings;

      const content = buildLandingSiteContent(settingsData);

      setSettings({
        landingHeroTitle: settingsData.landingHeroTitle || "",
        landingHeroSubtitle: settingsData.landingHeroSubtitle || "",
        landingAboutTitle: settingsData.landingAboutTitle || "",
        landingAboutContent: settingsData.landingAboutContent || "",
        landingHeroBadge:
          settingsData.landingHeroBadge || content.copy.landingHeroBadge || "",

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
        landingTestimonialsEyebrow: content.copy.landingTestimonialsEyebrow,
        landingTestimonialsTitle: content.copy.landingTestimonialsTitle,
        landingTestimonialsSubtitle: content.copy.landingTestimonialsSubtitle,

        landingCoverImageUrl:
          settingsData.landingCoverImageUrl ||
          settingsData.landing_cover_image_url ||
          "",
        landingThemeId: settingsData.landingThemeId || "gold",
        landingShowStaff: settingsData.landingShowStaff === true || settingsData.landingShowStaff === "true",
        landingShowStaffBio: settingsData.landingShowStaffBio === true || settingsData.landingShowStaffBio === "true",

        landingStats: content.stats || DEFAULT_LANDING_STATS,
        landingFeatures: content.features || DEFAULT_LANDING_FEATURES,
        landingTrustBadges: (content.trustBadges || DEFAULT_TRUST_BADGES).map(
          (label) => ({
            label: typeof label === "string" ? label : label?.label || "",
          }),
        ),
        landingTestimonials:
          content.testimonials || DEFAULT_LANDING_TESTIMONIALS,
        landingPortfolio: Array.isArray(settingsData.landingPortfolio)
          ? settingsData.landingPortfolio
          : [],

        socialFacebook: (settingsData.socialFacebook as string) || "",
        socialInstagram: (settingsData.socialInstagram as string) || "",
        socialTiktok: (settingsData.socialTiktok as string) || "",
        socialYoutube: (settingsData.socialYoutube as string) || "",
      });
    } catch (_err) {
      console.error("Failed to fetch website settings:", _err);
      toast.error("فشل تحميل إعدادات الموقع");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put("/business-settings", settings);
      toast.success("تم حفظ إعدادات الموقع بنجاح");
      onSaved?.();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || "فشل الحفظ — تحقق من البيانات ثم أعد المحاولة";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPortfolioImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageSize(file)) return;
    if ((settings.landingPortfolio?.length || 0) >= 20) {
      toast.error("الحد الأقصى 20 صورة في المعرض");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading("جاري رفع الصورة...", { id: "upload" });
      const res = await api.post("/business-settings/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {}) as { url?: string };
      const newUrl = data.url || "";

      setSettings((prev) => ({
        ...prev,
        landingPortfolio: [...(prev.landingPortfolio || []), newUrl],
      }));
      toast.success("تم إضافة الصورة للمعرض", { id: "upload" });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || "فشل رفع الصورة";
      toast.error(msg, { id: "upload" });
    } finally {
      e.target.value = "";
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageSize(file)) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading("جاري رفع صورة الغلاف...", { id: "cover-upload" });
      const res = await api.post("/business-settings/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {}) as { url?: string };

      setSettings((prev) => ({
        ...prev,
        landingCoverImageUrl: data.url || "",
      }));
      toast.success("تم تحديث صورة الغلاف", { id: "cover-upload" });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || "فشل رفع صورة الغلاف";
      toast.error(msg, { id: "cover-upload" });
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

  const removePortfolioImage = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      landingPortfolio: prev.landingPortfolio.filter((_, i) => i !== index),
    }));
  };

  const updateArrayItem = (key: string, index: number, field: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [key]: (prev[key] as unknown[]).map((item, itemIndex) =>
        itemIndex === index ? { ...(item as Record<string, unknown>), [field]: value } : item,
      ),
    }));
  };

  const updateField = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    onChangeDraft?.(settings);
  }, [onChangeDraft, settings]);

  return {
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
    removePortfolioImage,
    updateArrayItem,
    SUB_TABS,
  };
}
