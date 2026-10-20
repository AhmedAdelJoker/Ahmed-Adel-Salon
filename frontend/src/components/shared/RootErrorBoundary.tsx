import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/errorReporting";

interface RootErrorBoundaryProps {
  children?: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Root-level error boundary.
 *
 * Without this, any throw inside a provider (AuthProvider, SalonProvider,
 * SocketProvider, ...) unmounts the whole React tree. `#root` then stays empty
 * and the user sees nothing but the page background — which in dark mode is
 * near-black. That is the "black screen" symptom: the app never crashed the
 * tab, it just stopped rendering.
 *
 * This boundary sits *outside* every provider on purpose, so it is the last
 * line of defence for errors thrown during provider initialisation too.
 */
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[RootErrorBoundary]", error, errorInfo.componentStack);
    void reportError(error, errorInfo.componentStack ?? undefined);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private clearCaches = async () => {
    try {
      if ("caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      if (window.navigator.serviceWorker?.controller) {
        const registrations = await window.navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
    } catch {
      /* best effort — the reload below still runs */
    }
  };

  private handleHardReset = async () => {
    await this.clearCaches();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || "خطأ غير متوقع";

    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--surface-canvas)",
          color: "var(--content-primary)",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            border: "1px solid var(--line-default)",
            borderRadius: 20,
            padding: 28,
            background: "var(--surface-overlay)",
            boxShadow: "0 18px 40px rgba(0,0,0,.12)",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>
            تعذّر عرض التطبيق
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, opacity: 0.75 }}>
            حدث خط أثناء تحميل الصفحة. غالباً السبب ملفات مخزّنة قديمة في المتصفح.
          </p>
          <pre
            style={{
              margin: "0 0 20px",
              padding: 12,
              borderRadius: 12,
              background: "rgba(127,127,127,.12)",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 140,
              overflow: "auto",
            }}
          >
            {message}
          </pre>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleHardReset}
              style={{
                flex: 1,
                minWidth: 160,
                height: 44,
                borderRadius: 12,
                border: "none",
                background: "var(--primary)",
                color: "var(--action-primary-content)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              مسح الذاكرة وإعادة التحميل
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                flex: 1,
                minWidth: 120,
                height: 44,
                borderRadius: 12,
                border: "1px solid var(--line-default)",
                background: "transparent",
                color: "inherit",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }
}