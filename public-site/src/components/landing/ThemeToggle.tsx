import { Monitor, Moon, Sun } from "lucide-react";

import { useI18n } from "../../context/I18nContext";
import { useAppearance } from "../../lib/useAppearance";
import Switcher from "./Switcher";

/**
 * Appearance switcher — light / dark / as the salon chose.
 *
 * ## What this writes
 *
 * The choice is persisted under "theme", the same key the render-blocking
 * `/theme-init.js` reads, so the first paint already agrees with the stored
 * preference. A previous version used a second key ("salon-theme") alongside a
 * third implementation in `PreferencesContext`, so the two disagreed and the
 * page flashed on every load.
 *
 * ## Why it does not set `.dark` itself
 *
 * It used to. That directly contradicted `applyThemeMode()`, which sets the
 * same class from the salon's palette — two writers to one class is how a
 * light-OS visitor ended up with white panels holding white text.
 *
 * Instead the preference is lifted into `useAppearance()` and fed to
 * `resolveTheme()`, which moves the palette to the other *ground within the
 * same brand*. The accent the owner chose is preserved; only the background
 * flips.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [appearance, setAppearance] = useAppearance();

  return (
    <Switcher
      idPrefix="appearance"
      label={t("theme.label")}
      listLabel={t("theme.listLabel")}
      value={appearance}
      onChange={setAppearance}
      className={className}
      options={[
        { id: "light", label: t("theme.light"), icon: Sun },
        { id: "dark", label: t("theme.dark"), icon: Moon },
        { id: "system", label: t("theme.system"), icon: Monitor },
      ]}
    />
  );
}
