/**
 * Website/landing settings types (moved from pages/owner/WebsiteSettingsPanel.tsx).
 */
export interface BusinessSettings {
  landingHeroTitle?: string;
  landingHeroSubtitle?: string;
  landingAboutTitle?: string;
  landingAboutContent?: string;
  landingHeroBadge?: string;
  landingCoverImageUrl?: string;
  landing_cover_image_url?: string;
  landingThemeId?: string;
  landingFeatures?: unknown[];
  landingStats?: unknown[];
  landingTestimonials?: unknown[];
  landingTrustBadges?: unknown[];
  socialLinks?: unknown[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  [key: string]: unknown;
}

export interface SettingsState {
  landingHeroTitle: string;
  landingHeroSubtitle: string;
  landingAboutTitle: string;
  landingAboutContent: string;
  landingHeroBadge: string;
  landingServicesEyebrow: string;
  landingServicesTitle: string;
  landingServicesSubtitle: string;
  landingPortfolioEyebrow: string;
  landingPortfolioTitle: string;
  landingBookingEyebrow: string;
  landingBookingTitle: string;
  landingBookingSubtitle: string;
  landingLocationEyebrow: string;
  landingLocationTitle: string;
  landingLocationDescription: string;
  landingLocationOpenLabel: string;
  landingLocationClosedLabel: string;
  landingLocationStatusText: string;
  landingContactEyebrow: string;
  landingContactTitle: string;
  landingContactSubtitle: string;
  landingQuickActionsEyebrow: string;
  landingQuickActionsTitle: string;
  landingQuickActionsSubtitle: string;
  landingFinalTitle: string;
  landingFinalSubtitle: string;
  landingFinalButtonLabel: string;
  landingHeroHighlightTitle: string;
  landingHeroHighlightSubtitle: string;
  landingHeroHighlightBadge: string;
  landingPublicHeaderBadge: string;
  landingTestimonialsEyebrow: string;
  landingTestimonialsTitle: string;
  landingTestimonialsSubtitle: string;
  landingCoverImageUrl: string;
  landingThemeId: string;
  landingShowStaff: boolean;
  landingShowStaffBio: boolean;
  landingStats: { value?: string; label?: string; icon?: string; color?: string }[];
  landingFeatures: { title?: string; description?: string; icon?: string }[];
  landingTrustBadges: { label: string }[];
  landingTestimonials: { quote?: string; author?: string; role?: string }[];
  landingPortfolio: string[];
  socialFacebook: string;
  socialInstagram: string;
  socialTiktok: string;
  socialYoutube: string;
  [key: string]: unknown;
}
