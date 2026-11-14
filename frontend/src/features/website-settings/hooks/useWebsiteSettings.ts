import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
import { GALLERY_UPLOAD_MAX_SIZE, validateImageSize } from "@/lib/media/upload";
/*
  `heroVideo` sits beside this hook inside the feature, so the `@/lib` alias the
  rule asks for does not exist. Importing it through the feature barrel instead
  would be circular: the barrel re-exports this very hook.
*/
// eslint-disable-next-line no-restricted-imports
import {
  HERO_VIDEO_ACCEPT,
  HERO_VIDEO_MAX_SIZE,
  grabVideoPoster,
} from "../lib/heroVideo";

const SUB_TABS = [
  { id: "content", key: "website.tabContent", descKey: "website.tabContentDesc" },
  { id: "sections", key: "website.tabSections", descKey: "website.tabSectionsDesc" },
  { id: "portfolio", key: "website.tabPortfolio", descKey: "website.tabPortfolioDesc" },
  { id: "social", key: "website.tabSocial", descKey: "website.tabSocialDesc" },
  { id: "extras", key: "website.tabExtras", descKey: "website.tabExtrasDesc" },
  { id: "design", key: "website.tabDesign", descKey: "website.tabDesignDesc" },
];

interface UseWebsiteSettingsProps {
  onSaved?: () => void;
  onChangeDraft?: (settings: SettingsState) => void;
}

export function useWebsiteSettings({ onSaved, onChangeDraft }: UseWebsiteSettingsProps) {
  const { t } = useTranslation("owner");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("content");

  const [settings, setSettings] = useState<SettingsState>({
    landingHeroTitle: "",
    landingHeroSubtitle: "",
    landingAboutTitle: "",
    landingAboutContent: "",
    landingHeroBadge: "",
    // Motion defaults on: the public site treats an absent value as enabled
    // (so existing salons are unaffected), and the panel should show the switch
    // reflecting the state that will actually apply rather than an off-looking
    // toggle that means "on".
    landingHeroVideoUrl: "",
    landingVideoPosterUrl: "",
    landingVideoAutoplay: true,
    landingVideoMuted: true,
    landingMotionEnabled: true,
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
        // Read through the same alias-or-camel fallback the older fields use.
        // `false` is meaningful here and must survive: a `||` chain would turn
        // an explicit "motion off" back into "on".
        landingHeroVideoUrl:
          settingsData.landingHeroVideoUrl || settingsData.landing_hero_video_url || "",
        landingVideoPosterUrl:
          settingsData.landingVideoPosterUrl || settingsData.landing_video_poster_url || "",
        landingVideoAutoplay:
          settingsData.landingVideoAutoplay ?? settingsData.landing_video_autoplay ?? true,
        landingVideoMuted: settingsData.landingVideoMuted ?? settingsData.landing_video_muted ?? true,
        landingMotionEnabled:
          settingsData.landingMotionEnabled ?? settingsData.landing_motion_enabled ?? true,
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
      toast.error(t("website.loadFailed"));
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
      toast.success(t("website.saveSuccess"));
      onSaved?.();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || t("website.saveFailed");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPortfolioImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageSize(file, GALLERY_UPLOAD_MAX_SIZE)) return;
    if ((settings.landingPortfolio?.length || 0) >= 20) {
      toast.error(t("website.galleryMax"));
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading(t("website.imageUploading"), { id: "upload" });
      const res = await api.post("/business-settings/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {}) as { url?: string };
      const newUrl = data.url || "";

      setSettings((prev) => ({
        ...prev,
        landingPortfolio: [...(prev.landingPortfolio || []), newUrl],
      }));
      toast.success(t("website.imageAdded"), { id: "upload" });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || t("website.imageUploadFailed");
      toast.error(msg, { id: "upload" });
    } finally {
      e.target.value = "";
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImageSize(file, GALLERY_UPLOAD_MAX_SIZE)) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading(t("website.coverUploading"), { id: "cover-upload" });
      const res = await api.post("/business-settings/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {}) as { url?: string };

      setSettings((prev) => ({
        ...prev,
        landingCoverImageUrl: data.url || "",
      }));
      toast.success(t("website.coverUpdated"), { id: "cover-upload" });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || t("website.coverUploadFailed");
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

  /**
   * Hero video upload.
   *
   * Client-side validation is a courtesy, not the control: the server re-checks
   * extension and size in `validate_video`. It is here to give the owner an
   * instant answer on a large file instead of a 25 MB upload that fails at the
   * end — and, importantly, to derive the poster client-side, because the
   * backend stores the clip verbatim and therefore cannot hand one back.
   *
   * The poster is mandatory for the video to render at all (see
   * `buildLandingSiteContent`): a clip with no poster would blank the hero on
   * every browser that refuses to autoplay. If the frame grab fails, the
   * existing poster is left untouched rather than cleared.
   */
  const handleHeroVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!HERO_VIDEO_ACCEPT.split(",").some((ext) => file.name.toLowerCase().endsWith(ext))) {
      toast.error(t("website.videoFormat"), { id: "video-upload" });
      e.target.value = "";
      return;
    }
    if (file.size > HERO_VIDEO_MAX_SIZE) {
      toast.error(
        t("website.videoTooBig", { size: (file.size / 1024 / 1024).toFixed(1) }),
        { id: "video-upload" },
      );
      e.target.value = "";
      return;
    }

    // Grab a poster frame before uploading, so a failed upload never leaves the
    // hero pointing at a poster for a video that does not exist.
    let poster = "";
    try {
      poster = await grabVideoPoster(file);
    } catch {
      poster = "";
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.loading(t("website.videoUploading"), { id: "video-upload" });
      const res = await api.post("/business-settings/hero-video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = adaptObject(res, {}) as { url?: string };
      if (!data.url) throw new Error(t("website.videoNoUrl"));

      setSettings((prev) => ({
        ...prev,
        landingHeroVideoUrl: data.url || "",
        // Fall back to the cover image if the frame grab came back empty, so the
        // video still has something to show before it loads.
        landingVideoPosterUrl: poster || prev.landingCoverImageUrl || "",
        landingVideoAutoplay: true,
        landingVideoMuted: true,
      }));
      toast.success(t("website.videoUploaded"), { id: "video-upload" });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = ax?.response?.data?.detail || ax?.response?.data?.message || ax?.message || t("website.videoUploadFailed");
      toast.error(msg, { id: "video-upload" });
    } finally {
      e.target.value = "";
    }
  };

  const removeHeroVideo = () => {
    setSettings((prev) => ({
      ...prev,
      landingHeroVideoUrl: "",
      landingVideoPosterUrl: "",
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
    handleHeroVideoUpload,
    removeHeroVideo,
    removePortfolioImage,
    updateArrayItem,
    SUB_TABS,
  };
}
