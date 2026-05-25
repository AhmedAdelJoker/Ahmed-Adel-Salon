import { Moon, Sun } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { cn } from "../../lib/utils";

export default function ThemeSwitcher({ className = "" }) {
  const { theme, toggleTheme, saving } = usePreferences();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={saving}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 text-sm font-black text-gray-700 transition-all duration-300 hover:bg-purple-50 hover:text-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#171717] dark:text-gray-300 dark:hover:bg-cyan-400/10 dark:hover:text-[#22D3EE]",
        className,
      )}
      aria-label={isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDark ? "نهاري" : "ليلي"}</span>
    </button>
  );
}


