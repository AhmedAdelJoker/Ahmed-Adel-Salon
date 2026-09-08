import { toast } from "react-hot-toast";

export const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Validates file size before upload.
 * @param {File} file
 * @returns {boolean}
 */
export const validateImageSize = (file) => {
  if (!file) return false;

  if (file.size > MAX_IMAGE_SIZE) {
    toast.error("حجم الملف كبير جداً. الحد الأقصى المسموح به هو 20 ميجابايت.");
    return false;
  }

  return true;
};
