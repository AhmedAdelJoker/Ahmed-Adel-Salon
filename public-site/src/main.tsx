import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import { I18nProvider } from "./context/I18nContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { MemberAuthProvider } from "./context/MemberAuthContext";

// Self-hosted Arabic + Latin fonts (no Google Fonts dependency)
// Cairo: full Arabic + Latin support, used as primary
// Tajawal: alternate display font
import "@fontsource/cairo/200.css";
import "@fontsource/cairo/300.css";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/500.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/cairo/800.css";
import "@fontsource/cairo/900.css";

import "@fontsource/tajawal/200.css";
import "@fontsource/tajawal/300.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "@fontsource/tajawal/900.css";

// Register service worker for PWA + offline support
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <I18nProvider>
      <CurrencyProvider>
        <MemberAuthProvider>
          <App />
        </MemberAuthProvider>
      </CurrencyProvider>
    </I18nProvider>
  </React.StrictMode>
);
