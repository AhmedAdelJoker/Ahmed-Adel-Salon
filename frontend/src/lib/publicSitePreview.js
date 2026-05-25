export const PUBLIC_SITE_PREVIEW_STORAGE_KEY = "public-site-preview-draft";

export function readPublicSitePreviewDraft() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PUBLIC_SITE_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("Failed to read public site preview draft", error);
    return null;
  }
}

export function writePublicSitePreviewDraft(value) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PUBLIC_SITE_PREVIEW_STORAGE_KEY,
      JSON.stringify(value || {}),
    );
  } catch (error) {
    console.error("Failed to write public site preview draft", error);
  }
}
