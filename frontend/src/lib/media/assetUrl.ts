import { staticURL } from "@/services/api";

/**
 * Resolve a stored media path into a URL the browser can load.
 *
 * The API stores media as a bare path (`/uploads/offers/<uuid>.jpg`) and serves
 * it from the API's own origin, which is only the page's origin in a
 * same-origin deployment. `staticURL` is derived from the same `VITE_API_URL`
 * the api client uses, so a split-origin build resolves media against the API
 * host instead of a path that 404s.
 *
 * This existed as an inline `startsWith("http") ? x : \`${staticURL}${x}\``
 * in about ten places, each of which had to remember to handle `blob:` and
 * `data:` too — and the ones that forgot broke on the preview URLs an upload
 * shows before the server answers.
 */
export function resolveAssetUrl(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
  return `${staticURL.replace(/\/$/, "")}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

export default resolveAssetUrl;
