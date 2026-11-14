import { Component, type ErrorInfo, type ReactNode } from "react";
import { DEFAULT_LOCALE, htmlLang, isRTL, translate, type LocaleCode } from "../lib/i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  locale: LocaleCode;
}

const STORAGE_KEY = "salon-locale";

/**
 * ErrorBoundary — a render crash must not leave the visitor with a blank page.
 *
 * Without this, any error thrown during render unmounts the whole React tree
 * and the page becomes an empty dark rectangle with no way forward. The
 * fallback offers a reload and a way home, and reports the message so the
 * failure can be diagnosed from a user report instead of a console nobody
 * opens.
 *
 * This is a class component, so it cannot call `useI18n()`. It reads the
 * persisted locale directly and renders through the pure `translate()`
 * helper — the copy is still translated rather than hardcoded Arabic.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", locale: DEFAULT_LOCALE };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      hasError: true,
      message:
        error instanceof Error
          ? error.message
          : translate(DEFAULT_LOCALE, "common.error"),
    };
  }

  componentDidMount() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") {
        this.setState({ locale: stored });
      }
    } catch {
      // ignore
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { locale, message } = this.state;
    const t = (key: string) => translate(locale, key);

    return (
      <div
        dir={isRTL(locale) ? "rtl" : "ltr"}
        lang={htmlLang(locale)}
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center"
        style={{ backgroundColor: "var(--c-bg)", color: "#F8FAFC" }}
      >
        <main className="flex max-w-md flex-col items-center gap-6">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("error.title")}</h1>
          <p className="text-sm font-bold leading-relaxed text-ink-soft">{t("error.body")}</p>
          {message ? (
            <p className="break-words rounded-2xl border border-line bg-inset px-4 py-3 text-xs text-ink-faint">
              {message}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-12 rounded-2xl px-7 font-bold transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              style={{ backgroundColor: "var(--c-accent)", color: "var(--c-bg)" }}
            >
              {t("common.retry")}
            </button>
            <a
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line-strong px-7 font-bold text-ink transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {t("common.home")}
            </a>
          </div>
        </main>
      </div>
    );
  }
}
