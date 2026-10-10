/**
 * Frontend error reporting.
 *
 * `RootErrorBoundary` is the last thing standing between a provider throw and a
 * blank canvas, so its `componentDidCatch` is the highest-value place to ship
 * a stack trace off the machine. Console-only logging loses it the moment the
 * tab closes.
 *
 * Failure is always silent by design: reporting must never be able to break
 * the error UI it is reporting from.
 */

const ENDPOINT = "/telemetry/client-errors";

function isEnabled(): boolean {
  if (import.meta.env.DEV) return false;
  if (import.meta.env.VITE_ENABLE_ERROR_REPORTING === "false") return false;
  return true;
}

/** Strips anything that looks like a credential before it leaves the browser. */
function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, "$1[redacted]")
      .replace(/("?(?:password|token|secret|api_?key)"?\s*[:=]\s*")[^"]+/gi, "$1[redacted]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = /password|token|secret|api_?key/i.test(key) ? "[redacted]" : redact(item);
    }
    return out;
  }
  return value;
}

export interface ClientErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  release?: string;
}

export async function reportError(
  error: unknown,
  componentStack?: string,
): Promise<void> {
  if (!isEnabled()) return;

  try {
    const normalised =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };

    const report: ClientErrorReport = {
      ...redact(normalised) as { message: string; stack?: string },
      componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      release: import.meta.env.VITE_APP_VERSION,
    };

    const { staticURL } = await import("@/services/api");

    // `keepalive` so the report survives a navigation or an unload right after
    // the error — which is exactly when a black screen usually gets hit.
    await fetch(`${staticURL}/api/v1${ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
      credentials: "include",
    });
  } catch {
    /* reporting must never escalate */
  }
}