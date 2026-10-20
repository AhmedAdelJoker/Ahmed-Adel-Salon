import { Link } from "react-router-dom";
import { ArrowLeft, CalendarCheck2 } from "lucide-react";

import { useI18n } from "../context/I18nContext";
import { useSEO } from "../hooks/useSEO";

/**
 * NotFoundPage — honest 404.
 *
 * The catch-all route used to render the landing page, which meant every typo
 * in a URL produced a 200 response containing the full landing page: a soft 404,
 * bad for indexing and confusing for visitors. The hosts now serve `dist/404.html`
 * with a real 404 status, and this component covers the client-side case (for
 * example after an in-app navigation to a bad path).
 *
 * It is marked noindex at runtime as well, so a crawler that executes
 * JavaScript still gets the hint.
 *
 * Colours come from the palette custom properties rather than an `INK` constant
 * that no longer exists — the page inherits whatever salon the visitor was on,
 * instead of always painting a black rectangle.
 */
export default function NotFoundPage() {
  const { t } = useI18n();

  useSEO({
    title: t("notFound.title"),
    description: t("notFound.body"),
    noindex: true,
  });

  if (typeof document !== "undefined") {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, follow");
  }

  return (
    <div className="grain relative flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        <p
          className="text-[length:var(--step-6)] font-bold leading-none text-accent"
          aria-hidden="true"
          style={{ letterSpacing: "var(--tracking-display)" }}
        >
          404
        </p>

        <h1 className="text-[length:var(--step-3)] font-bold text-balance">
          {t("notFound.title")}
        </h1>

        <p className="measure-tight text-[length:var(--step-0)] leading-relaxed text-ink-soft">
          {t("notFound.body")}
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className="btn-base btn-base--solid min-h-11 px-6 text-[length:var(--step--1)]">
            <ArrowLeft size={16} aria-hidden="true" className="rtl-flip" />
            {t("common.home")}
          </Link>

          <Link
            to="/book"
            className="btn-base btn-base--outline min-h-11 px-6 text-[length:var(--step--1)]"
          >
            <CalendarCheck2 size={16} aria-hidden="true" />
            {t("notFound.book")}
          </Link>
        </div>
      </main>
    </div>
  );
}
