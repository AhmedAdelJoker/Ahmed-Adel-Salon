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
 *
 * ## The layout
 *
 * The section is a *list*, not a stack of panels. A boxed accordion in the
 * middle of a page whose other sections are rules and columns read as a
 * widget dropped in from another template, and the questions ended up in a
 * narrow column stranded to one side of a 1216px box.
 *
 * So the header sits on the reading edge and the questions run the full width
 * of the shell beneath it, one per row, separated by the same hairline the
 * service menu uses. The `+` rotates into the `×` that says "open" without a
 * second control.
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
    <section id="faq" className="mk-shell py-[length:var(--section-y)]">
      {/*
        The same header as every other section: eyebrow with a rule, serif
        title, one lead paragraph, all on the reading edge.
      */}
      <header className="mk-svc-head">
        <div>
          {eyebrow ? <p className="mk-eyebrow">{eyebrow}</p> : null}
          <h2
            className="mk-h2"
            style={{ marginTop: eyebrow ? "0.75rem" : undefined }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mk-lead" style={{ marginTop: "1.15rem" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mk-faq">
        {items.map((item) => (
          <details
            key={item.q}
            className="faq-item group mk-faq__row"
            style={{ borderColor: theme.border }}
          >
            {/*
              `summary` is the disclosure. `marker` removal is done in CSS
              because there is no attribute for it, and the icon is a sibling
              of the label rather than inside it so it is not announced.
            */}
            <summary className="faq-item__summary mk-faq__q">
              <span className="mk-faq__label">{item.q}</span>
              <span
                aria-hidden="true"
                className="mk-faq__icon shrink-0"
                style={{ color: theme.accent }}
              >
                <Plus size={20} />
              </span>
            </summary>

            <p className="mk-faq__a">{item.a}</p>
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
