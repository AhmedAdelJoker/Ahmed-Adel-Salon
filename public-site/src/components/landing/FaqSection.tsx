/**
 * FaqSection — the questions the `FAQPage` schema describes.
 *
 * The schema was already being published while this section did not exist, so
 * the structured data pointed at questions no visitor could find on the page.
 * That is worse than publishing nothing: it invites a rich result that has
 * nothing to render.
 *
 * Native `<details>` rather than a JS accordion. The platform gives keyboard
 * operation, the open/closed state that assistive technology reports, and the
 * find-in-page behaviour, and it survives a failed hydration. A div with
 * onClick and an `aria-expanded` that only the component knows about reproduces
 * all of that badly.
 *
 * Every answer is in the DOM whether open or not, which is deliberate: the copy
 * is the same copy the schema publishes, and hiding it behind a click is what
 * makes the two drift apart.
 */

import { Plus } from "lucide-react";

import type { BrandTheme } from "../../lib/theme";

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface FaqSectionProps {
  theme: BrandTheme;
  t: Translate;
  /** Question/answer pairs, already translated by the caller. */
  items: { q: string; a: string }[];
  title: string;
  subtitle?: string;
  eyebrow?: string;
}

export default function FaqSection({
  theme,
  t,
  items,
  title,
  subtitle,
  eyebrow,
}: FaqSectionProps) {
  if (items.length === 0) return null;

  return (
    <section
      id="faq"
      className="mx-auto w-full max-w-7xl px-4 py-[length:var(--section-y)] sm:px-6 lg:px-8"
    >
      <header className="reveal mb-10 max-w-2xl">
        {eyebrow ? (
          <p
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: theme.accent }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className="text-[length:var(--step-2)] font-bold leading-[1.2] tracking-normal text-balance"
          style={{ color: theme.text }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-4 text-sm font-bold leading-7 sm:text-base" style={{ color: theme.muted }}>
            {subtitle}
          </p>
        ) : null}
      </header>

      <div
        className="reveal divide-y overflow-hidden rounded-[var(--r-lg)] border"
        style={{ borderColor: theme.border, backgroundColor: theme.card }}
      >
        {items.map((item) => (
          <details
            key={item.q}
            className="faq-item group px-5 py-5 sm:px-7 sm:py-6"
            style={{ borderColor: theme.border }}
          >
            {/*
              `summary` is the disclosure. `marker` removal is done in CSS
              because there is no attribute for it, and the icon is a sibling
              of the label rather than inside it so it is not announced.
            */}
            <summary className="faq-item__summary flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
              <span className="text-[length:var(--step-0)] leading-snug" style={{ color: theme.text }}>
                {item.q}
              </span>
              <span
                aria-hidden="true"
                className="faq-item__icon shrink-0 transition-transform duration-300 group-open:rotate-45"
                style={{ color: theme.accent }}
              >
                <Plus size={20} />
              </span>
            </summary>

            <p
              className="measure-tight mt-3 text-[length:var(--step-0)] font-medium leading-[1.8]"
              style={{ color: theme.muted }}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>

      {/* Nothing to announce here; the summary owns the state. Kept as a
          visually-hidden note so the section is not a bare wall of text for a
          screen-reader user who arrives past it. */}
      <p className="sr-only">{t("landing.faqHint")}</p>
    </section>
  );
}