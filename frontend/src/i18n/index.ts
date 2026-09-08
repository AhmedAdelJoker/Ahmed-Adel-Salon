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

export default i18n;
