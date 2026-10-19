import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { I18nProvider } from "./context/I18nContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { MemberAuthProvider } from "./context/MemberAuthContext";

/**
 * Self-hosted Arabic + Latin fonts — no Google Fonts request, so no
 * third-party connection and no third-party cookie.
 *
 * Only the weights the interface actually renders are imported. The previous
 * setup pulled eight weights of Cairo and seven of Tajawal, in both .woff2 and
 * .woff, for thirty files totalling roughly 1.3 MB — while the only weights any
 * utility class asked for were 700 (font-bold) and 900 (font-bold). Tajawal
 * was never applied at all: it appeared solely as a late fallback inside
 * --font-display and --font-arabic, and no component sets either.
 */
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/900.css";

// Register the service worker for PWA install + offline support.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.info("Service worker registered, scope:", reg.scope))
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <CurrencyProvider>
          <MemberAuthProvider>
            <App />
          </MemberAuthProvider>
        </CurrencyProvider>
      </I18nProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
