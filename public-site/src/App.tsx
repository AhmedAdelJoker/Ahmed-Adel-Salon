import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { Scissors } from "lucide-react";
import { useI18n } from "./context/I18nContext";
import PWAInstallPrompt from "./components/landing/PWAInstallPrompt";
import LiveChat from "./components/landing/LiveChat";
import Analytics from "./components/landing/Analytics";
import NotFoundPage from "./pages/NotFoundPage";
import api from "./services/api";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const OfflinePage = lazy(() => import("./pages/OfflinePage"));
const EntityPage = lazy(() => import("./pages/EntityPage"));

/**
 * Route transition fallback.
 *
 * Honours prefers-reduced-motion: the decorative spinner is dropped because the
 * skeleton already communicates that the page is loading.
 *
 * The previous version put two `blur-[70px]`/`blur-[120px]` gold circles behind
 * this. They re-composited on every frame for the whole duration of the fetch
 * and produced a grey haze rather than anything recognisable, so they are gone
 * — the mark alone carries the wait.
 */
/**
 * `/salon` with no slug → the salon's real slug.
 *
 * Reads the published slug from the public catalog and redirects. If the site is
 * unpublished (catalog 404s) it falls back to the bare `salon`, which renders the
 * landing with defaults — the same page `/` already serves.
 */
function SalonIndex() {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/public/booking-catalog")
      .then((res) => {
        if (!cancelled) {
          setSlug(res?.data?.business?.public_slug || "salon");
        }
      })
      .catch(() => {
        if (!cancelled) setSlug("salon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!slug) return <RouteLoader />;
  return <Navigate to={`/salon/${slug}`} replace />;
}

function RouteLoader() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex flex-col items-center gap-7 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-[length:var(--r-lg)] border border-line bg-panel text-accent">
          <Scissors size={34} aria-hidden="true" />
        </div>

        {/* Announced to assistive tech; the artwork above is decorative. */}
        <p role="status" aria-live="polite" className="sr-only">
          {t("loader.announcing")}
        </p>

        <div className="space-y-2">
          <p
            className="text-[length:var(--step--2)] font-semibold uppercase text-accent"
            style={{ letterSpacing: "var(--tracking-eyebrow)" }}
          >
            {t("loader.eyebrow")}
          </p>
          <h1 className="text-[length:var(--step-1)] font-bold text-ink">
            {t("loader.subtitle")}
          </h1>
        </div>

        <div
          className="h-0.5 w-40 overflow-hidden rounded-full bg-[color:var(--c-border)]"
          aria-hidden="true"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            }
            className="h-full bg-accent"
          />
        </div>
      </div>
    </div>
  );
}

/** Shared reduced-motion probe, so JS animations respect the OS setting. */
function usePrefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function App() {
  const { t } = useI18n();

  return (
    <TooltipProvider delayDuration={400}>
      <BrowserRouter>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-1/2 focus:top-4 focus:z-[9999] focus:-translate-x-1/2 focus:rounded-[length:var(--r-sm)] focus:bg-accent focus:px-7 focus:py-3 focus:text-[length:var(--step--1)] focus:font-semibold focus:text-on-accent focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas"
        >
          {t("common.skipToContent")}
        </a>

        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            {/* Legacy aliases for the same document; both canonicalise to "/". */}
            <Route path="/shop" element={<LandingPage />} />
            <Route path="/booking" element={<PublicBooking />} />
            <Route path="/book" element={<PublicBooking />} />
            <Route path="/schedule" element={<SchedulePage />} />
            {/*
              `/salon` with no slug is the one URL a person will actually type,
              and it used to fall through to the catch-all `NotFoundPage` — a
              dead end for the bare word the site is named after.

              It resolves the salon's published slug and redirects. It does not
              render `LandingPage` directly: every internal link, canonical and
              `EntityPage` deep-link is built against `/salon/:slug`, so serving
              the page on a second address would be the duplicate again, one URL
              removed.
            */}
            <Route path="/salon" element={<SalonIndex />} />
            <Route path="/salon/:publicSlug" element={<LandingPage />} />
            <Route path="/salon/:publicSlug/book" element={<PublicBooking />} />
            <Route path="/salon/:publicSlug/schedule" element={<SchedulePage />} />
            {/*
              Entity detail pages. Every one is under /salon/*, which is the
              scope the Netlify SPA fallback covers (netlify.toml) — a route
              outside that scope would return a real 404 on Netlify while working
              on Vercel.
            */}
            <Route
              path="/salon/:publicSlug/service/:entityId"
              element={<EntityPage kind="service" />}
            />
            <Route
              path="/salon/:publicSlug/barber/:entityId"
              element={<EntityPage kind="barber" />}
            />
            <Route
              path="/salon/:publicSlug/offer/:entityId"
              element={<EntityPage kind="offer" />}
            />
            <Route path="/offline" element={<OfflinePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>

        {/* Global utilities — must stay INSIDE the Router (Analytics reads the
            location) but OUTSIDE the page's <main> landmark. */}
        <PWAInstallPrompt />
        <LiveChat />
        <Analytics />
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: "12px",
            border: "1px solid var(--c-border)",
            background: "var(--c-card)",
            color: "var(--c-text)",
            fontWeight: "600",
            fontSize: "14px",
            padding: "12px 18px",
          },
          success: { iconTheme: { primary: "var(--c-accent)", secondary: "var(--c-on-accent)" } },
          error: { iconTheme: { primary: "var(--c-stop)", secondary: "var(--c-on-text)" } },
        }}
      />
    </TooltipProvider>
  );
}
