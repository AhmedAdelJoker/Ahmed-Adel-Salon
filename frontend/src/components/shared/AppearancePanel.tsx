import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Contrast,
  Gauge,
  MonitorSmartphone,
  Palette,
  RotateCcw,
  Sparkles,
  SunMoon,
  Zap,
} from "lucide-react";
import {
  ACCENTS,
  DENSITIES,
  MOTIONS,
  useAppearance,
  type Accent,
} from "@/context/AppearanceContext";
import { usePreferences } from "@/context/PreferencesContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

/**
 * Appearance — the control surface for the v2 token layer.
 *
 * Every control here writes exactly one attribute on <html>; nothing in this
 * component paints anything itself. That is what keeps "change the look of the
 * whole product" a one-file operation instead of a 70-page migration.
 *
 * The accent swatches are painted with hardcoded ramp values on purpose: a
 * swatch has to show the colour it selects, and resolving it through the live
 * custom property would make every swatch render the currently-active accent.
 */

/**
 * Accent swatch gradients.
 *
 * Literal values on purpose: a swatch has to render the colour it selects, and
 * resolving it through the live custom property would make all five show the
 * currently-active accent. The human-readable name comes from i18n; only the
 * paint is hardcoded, which is why this file is on the hex allowlist in
 * `design-tokens.test.ts`.
 */
const ACCENT_SWATCH: Record<Accent, { from: string; to: string }> = {
  indigo: { from: "#6366f1", to: "#4338ca" },
  violet: { from: "#8b5cf6", to: "#6d28d9" },
  cyan: { from: "#0ea5e9", to: "#0369a1" },
  emerald: { from: "#10b981", to: "#047857" },
  gold: { from: "#c9a227", to: "#87681a" },
};

/**
 * Status preview tiles.
 *
 * The class strings are written out in full on purpose. Building them as
 * `border-${tone}-line` would make Tailwind's scanner see the literal
 * `border-${tone}-line`, match nothing, and silently emit no rule at all —
 * leaving three unstyled boxes. Every class a component needs has to appear
 * verbatim somewhere in the source.
 */
const STATUS_PREVIEW = [
  { tone: "success", value: "1,240", frame: "border-success-line bg-success-bg", ink: "text-success-content" },
  { tone: "warning", value: "18", frame: "border-warning-line bg-warning-bg", ink: "text-warning-content" },
  { tone: "danger", value: "3", frame: "border-danger-line bg-danger-bg", ink: "text-danger-content" },
] as const;

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Palette;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-solid overflow-hidden">
      <header className="flex items-start gap-3 border-b border-line-subtle px-5 py-4">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/12 text-accent-600 dark:text-accent-400">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-title-md text-content">{title}</h3>
          <p className="text-body-sm text-content-tertiary">{description}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Segmented control shared by the density and motion pickers. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  describe,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  describe: (option: T) => { label: string; hint: string };
}) {
  const groupId = useId();
  return (
    <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2 sm:grid-cols-3">
      <span id={groupId} className="sr-only">
        {label}
      </span>
      {options.map((option) => {
        const { label: optionLabel, hint } = describe(option);
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={[
              "group flex flex-col items-start gap-0.5 rounded-lg border p-3 text-start transition-all duration-base",
              selected
                ? "border-accent-500 bg-accent-500/10 shadow-elev-1"
                : "border-line-subtle bg-surface hover:border-line-strong hover:bg-surface-hover",
            ].join(" ")}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span
                className={[
                  "text-title-sm",
                  selected ? "text-content" : "text-content-secondary",
                ].join(" ")}
              >
                {optionLabel}
              </span>
              {selected ? (
                <Check className="size-4 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              ) : null}
            </span>
            <span className="text-body-xs text-content-tertiary">{hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One control per attribute on <html>, and nothing else.
 *
 * Every control writes a single attribute and paints nothing itself, which is
 * what keeps "change the look of the whole product" a one-file operation
 * instead of a 70-page migration. The accent swatches are the one exception and
 * use literal ramp values on purpose: a swatch has to show the colour it
 * selects, and resolving it through the live custom property would make every
 * swatch render the currently-active accent.
 */
/**
 * Light / dark.
 *
 * This is the one axis that lives in the profile rather than in localStorage:
 * it follows the person across devices, where accent, density and motion
 * describe the hardware and must not. `PreferencesContext` owns it, so this
 * section deliberately reads from there instead of AppearanceContext.
 */
function ThemeSection({
  theme,
  onChange,
}: {
  theme: "light" | "dark";
  onChange: (next: "light" | "dark") => void;
}) {
  const { t } = useTranslation("appearance");
  const options = [
    { id: "light" as const, swatch: "bg-zinc-50" },
    { id: "dark" as const, swatch: "bg-zinc-950" },
  ];

  return (
    <Section
      icon={SunMoon}
      title={t("sections.theme.title")}
      description={t("sections.theme.description")}
    >
      <div role="radiogroup" aria-label={t("sections.theme.title")} className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={[
                "flex items-center gap-3 rounded-lg border p-3 text-start transition-all duration-base",
                selected
                  ? "border-accent-500 bg-accent-500/10 shadow-elev-1"
                  : "border-line-subtle bg-surface hover:border-line-strong hover:bg-surface-hover",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={`size-9 shrink-0 rounded-md border border-line ${option.swatch}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-title-sm text-content">
                  {t(`sections.theme.${option.id}`)}
                </span>
                <span className="block text-body-xs text-content-tertiary">
                  {t(`sections.theme.${option.id}Hint`)}
                </span>
              </span>
              {selected ? (
                <Check className="size-4 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export function AppearancePanel({ showHeader = true }: { showHeader?: boolean }) {
  const { t } = useTranslation("appearance");
  const {
    accent,
    density,
    motion,
    highContrast,
    setAccent,
    setDensity,
    setMotion,
    setHighContrast,
    reset,
    prefersReducedMotion,
  } = useAppearance();

  const { theme, setTheme } = usePreferences();

  /**
   * `isDefault` has to account for the theme too, otherwise "reset" stays
   * enabled while the one preference the user can still see unchanged is light
   * instead of the stored default.
   */
  const isDefault =
    accent === "indigo" &&
    density === "comfortable" &&
    motion === "normal" &&
    !highContrast &&
    theme === "dark";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {showHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-display-sm text-content">{t("title")}</h2>
            <p className="text-body-sm text-content-secondary">{t("subtitle")}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setTheme("dark");
            }}
            disabled={isDefault}
            className="gap-2"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("reset")}
          </Button>
        </header>
      ) : null}

      <ThemeSection theme={theme} onChange={setTheme} />

      <Section
        icon={Palette}
        title={t("sections.accent.title")}
        description={t("sections.accent.description")}
      >
        <div
          role="radiogroup"
          aria-label={t("sections.accent.title")}
          className="flex flex-wrap gap-2.5"
        >
          {ACCENTS.map((option) => {
            const swatch = ACCENT_SWATCH[option];
            const selected = option === accent;
            const label = t(`accents.${option}`);
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                onClick={() => setAccent(option)}
                className={[
                  "group relative flex size-12 items-center justify-center rounded-xl transition-all duration-base",
                  selected
                    ? "ring-2 ring-accent-500 ring-offset-2 ring-offset-[var(--surface-canvas)]"
                    : "hover:scale-105",
                ].join(" ")}
                style={{ backgroundImage: `linear-gradient(135deg, ${swatch.from}, ${swatch.to})` }}
              >
                {selected ? (
                  <Check className="size-5 text-white drop-shadow" aria-hidden="true" />
                ) : null}
                <span className="pointer-events-none absolute -bottom-6 start-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-content-tertiary opacity-0 transition-opacity group-hover:opacity-100 rtl:translate-x-1/2">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        icon={Gauge}
        title={t("sections.density.title")}
        description={t("sections.density.description")}
      >
        <Segmented
          label={t("sections.density.title")}
          options={DENSITIES}
          value={density}
          onChange={setDensity}
          describe={(option) => ({
            label: t(`densityOptions.${option}`),
            hint: t(`densityOptions.${option}Hint`),
          })}
        />
      </Section>

      <Section
        icon={Zap}
        title={t("sections.motion.title")}
        description={t("sections.motion.description")}
      >
        <Segmented
          label={t("sections.motion.title")}
          options={MOTIONS}
          value={motion}
          onChange={setMotion}
          describe={(option) => ({
            label: t(`motionOptions.${option}`),
            hint: t(`motionOptions.${option}Hint`),
          })}
        />
        {prefersReducedMotion ? (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-info-line bg-info-bg px-3 py-2 text-body-xs text-info-content"
          >
            <MonitorSmartphone className="mt-px size-4 shrink-0" aria-hidden="true" />
            {t("motionSystemOverride")}
          </p>
        ) : null}
      </Section>

      <Section
        icon={Contrast}
        title={t("sections.contrast.title")}
        description={t("sections.contrast.description")}
      >
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line-subtle p-3.5">
          <span className="min-w-0">
            <span className="block text-title-sm text-content">
              {t("sections.contrast.title")}
            </span>
            <span className="block text-body-xs text-content-tertiary">
              {t("sections.contrast.hint")}
            </span>
          </span>
          <Switch
            checked={highContrast}
            onCheckedChange={setHighContrast}
            aria-label={t("sections.contrast.label")}
          />
        </label>
      </Section>

      <Section
        icon={Sparkles}
        title={t("sections.preview.title")}
        description={t("sections.preview.description")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">{t("previewButtons.primary")}</Button>
          <Button size="sm" variant="secondary">
            {t("previewButtons.secondary")}
          </Button>
          <Button size="sm" variant="ghost">
            {t("previewButtons.ghost")}
          </Button>
          <span className="badge badge-success">{t("previewBadges.success")}</span>
          <span className="badge badge-warning">{t("previewBadges.warning")}</span>
          <span className="badge badge-danger">{t("previewBadges.danger")}</span>
          <span className="badge badge-info">{t("previewBadges.info")}</span>
          <span className="badge badge-muted">{t("previewBadges.neutral")}</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {STATUS_PREVIEW.map((item) => (
            <div key={item.tone} className={`rounded-lg border p-3 ${item.frame}`}>
              <p className={`text-body-xs font-semibold ${item.ink}`}>
                {t(`previewStatus.${item.tone}`)}
              </p>
              <p className="numeric mt-1 text-title-lg text-content">{item.value}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export default AppearancePanel;
