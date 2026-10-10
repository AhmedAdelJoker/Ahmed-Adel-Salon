import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { RootErrorBoundary } from "@/components/shared/RootErrorBoundary";
import { registerServiceWorker } from "@/lib/pwa";
import "./styles/index.css";
import "./i18n";

const container = document.getElementById("root");

// A missing/misconfigured #root leaves createRoot unable to mount, which again
// renders as a blank canvas. Fail loudly in the console instead of silently.
if (!container) {
  throw new Error("Root element #root not found in index.html");
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    {/* Outside every provider on purpose: catches provider-init throws too. */}
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);

registerServiceWorker();