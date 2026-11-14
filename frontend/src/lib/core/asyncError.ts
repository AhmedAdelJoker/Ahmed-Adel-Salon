/**
 * Helpers for turning a failed request into something a user can act on.
 *
 * The pattern this replaces was `catch { console.error(...) }` inside feature
 * hooks, which left the page rendering an empty shell with no indication that
 * anything had failed. On a live till that reads as "no data today" rather than
 * "the request failed", and the user has no reason to retry.
 */

/** Normalises anything thrown into a short, presentable Arabic message. */
export function toErrorMessage(
  error: unknown,
  fallback = "تعذر تحميل البيانات. تحقق من الاتصال ثم أعد المحاولة.",
): string {
  if (!error) return fallback;

  if (typeof error === "string" && error.trim()) return error.trim();

  if (typeof error === "object") {
    const err = error as {
      response?: { data?: { detail?: unknown; message?: unknown } };
      message?: unknown;
    };
    const detail = err.response?.data?.detail ?? err.response?.data?.message;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message.trim();
    }
  }

  return fallback;
}

/**
 * True when the failure looks like the user is offline or the API is
 * unreachable, as opposed to the request being rejected on its merits. Worth
 * showing a different hint for.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const err = error as { code?: string; message?: string } | undefined;
  if (!err) return false;
  return (
    err.code === "ERR_NETWORK" ||
    /network|failed to fetch|timeout/i.test(err.message ?? "")
  );
}

/** Message for a failed load, distinguishing connectivity from a server error. */
export function loadErrorMessage(error: unknown, subject = "البيانات"): string {
  if (isNetworkError(error)) {
    return `تعذر الوصول إلى الخادم. تأكد من الاتصال ثم أعد المحاولة لتحميل ${subject}.`;
  }
  return `تعذر تحميل ${subject}. أعد المحاولة.`;
}
