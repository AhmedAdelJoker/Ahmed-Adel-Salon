import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { usePreferences } from "@/context/PreferencesContext";
import { Languages } from "lucide-react";

export default function LanguageSwitcher({ className = "" }) {
  const { loading } = useAuth();
  const { i18n } = useTranslation();
  const { toggleLanguage } = usePreferences();
  const isArabic = i18n.language === "ar";

  return (
    <button
      type="button"
      disabled={loading}
      onClick={toggleLanguage}
      className={`btn btn-secondary btn-md rounded-2xl font-black ${className}`}
      aria-label={
        isArabic ? "Switch language to English" : "تبديل اللغة إلى العربية"
      }
      dir={isArabic ? "rtl" : "ltr"}
    >
      <Languages size={16} aria-hidden="true" />
      <span>{isArabic ? "English" : "العربية"}</span>
    </button>
  );
}
