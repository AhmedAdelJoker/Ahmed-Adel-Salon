import { Globe } from "lucide-react";
import { useI18n } from "../../context/I18nContext";
import Switcher from "./Switcher";

/**
 * Language switcher — AR / EN.
 *
 * Two things worth keeping from the version this replaces:
 *
 *  - No flag emoji. `aria-hidden` hid it visually but several screen readers
 *    still announce the regional-indicator characters ("flag: Saudi Arabia"),
 *    and a flag does not name a language anyway. Each option is identified by
 *    its own endonym.
 *  - `aria-label` comes from the catalogue and names the control. It used to be
 *    the English literal "Switch language" sitting on an Arabic page.
 */
export interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { locale, setLocale, availableLocales, t } = useI18n();

  return (
    <Switcher
      idPrefix="language"
      className={className}
      label={t("language.label")}
      listLabel={t("language.listLabel")}
      icon={Globe}
      value={locale}
      onChange={setLocale}
      options={availableLocales.map((meta) => ({
        id: meta.code,
        label: meta.label,
      }))}
    />
  );
}
