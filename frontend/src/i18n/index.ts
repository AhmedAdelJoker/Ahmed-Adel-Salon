import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import arCommon from "@/i18n/locales/ar/common.json";
import enCommon from "@/i18n/locales/en/common.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "ar",
    lng: localStorage.getItem("language") || "ar",
    interpolation: {
      escapeValue: false,
    },
    resources: {
      ar: {
        common: arCommon,
      },
      en: {
        common: enCommon,
      },
    },
    ns: ["common"],
    defaultNS: "common",
  });

export function applyDocumentDirection(lng?: string): "rtl" | "ltr" {
  const lang = (lng || i18n.language || "ar").split("-")[0];
  const dir = lang === "ar" ? "rtl" : "ltr";
  if (typeof document !== "undefined") {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }
  return dir;
}

// Keep <html dir/lang> in sync on boot + every language change so layout
// shells (sidebar/header/drawer) follow the active language instead of a
// hardcoded dir="rtl".
applyDocumentDirection();
i18n.on("languageChanged", (lng) => applyDocumentDirection(lng));

export default i18n;
