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

// The boot splash lives inline in index.html so it is on screen at the first
// frame. React replaces #root's children, not this sibling, so it has to be
// removed explicitly — otherwise it would sit on top of the app forever.
function dismissBootSplash() {
  document.getElementById("boot-splash")?.remove();
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    {/* Outside every provider on purpose: catches provider-init throws too. */}
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);

// Remove the boot splash after React has committed the first render.
// `setTimeout(..., 0)` runs after the current task (including React's commit)
// and the microtask queue, which is more reliable than double rAF in React 18
// concurrent mode where the first commit may not align with paint frames.
setTimeout(dismissBootSplash, 0);

registerServiceWorker();