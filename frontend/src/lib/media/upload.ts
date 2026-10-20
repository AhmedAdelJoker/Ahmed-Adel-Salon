import { toast } from "react-hot-toast";

/**
 * Default ceiling for an image upload.
 *
 * This was 20 MB while every image endpoint enforces 5 MB
 * (`validate_image(file, max_size=5 * 1024 * 1024)` in `employees`, `offers`,
 * `services`, `products`, `business-settings/logo`, `profile/avatar`), so a
 * user who picked a 12 MB photo sat through the whole upload to be answered
 * with a 413. The limit is now the one the server actually applies, and the
 * few endpoints that allow more say so explicitly.
 */
export const IMAGE_UPLOAD_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

/** `business-settings/media` is the one endpoint that accepts 10 MB. */
export const GALLERY_UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/** @deprecated use IMAGE_UPLOAD_MAX_SIZE — kept so existing imports resolve. */
export const MAX_IMAGE_SIZE = IMAGE_UPLOAD_MAX_SIZE;

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Validates file size before upload.
 * @param {File} file
 * @param {number} maxBytes ceiling; defaults to the 5 MB the endpoints enforce
 * @returns {boolean}
 */
export const validateImageSize = (file, maxBytes: number = IMAGE_UPLOAD_MAX_SIZE) => {
  if (!file) return false;

  if (file.size > maxBytes) {
    toast.error(`حجم الملف كبير جداً. الحد الأقصى المسموح به هو ${mb(maxBytes)} ميجابايت.`);
    return false;
  }

  return true;
};
