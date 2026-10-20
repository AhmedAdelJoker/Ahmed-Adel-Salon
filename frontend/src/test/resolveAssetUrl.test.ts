import { describe, it, expect } from "vitest";
import { resolveAssetUrl } from "@/lib/media/assetUrl";

/**
 * The API stores media as a bare path and serves it from the API origin, which
 * is the page origin only in a same-origin deployment. In a split-origin build
 * the bare path 404s, so the origin has to come from the same `VITE_API_URL`
 * the api client uses.
 */
describe("resolveAssetUrl", () => {
  it("returns null for nothing", () => {
    expect(resolveAssetUrl(null)).toBeNull();
    expect(resolveAssetUrl(undefined)).toBeNull();
    expect(resolveAssetUrl("")).toBeNull();
  });

  it("passes an absolute, blob or data URL through untouched", () => {
    expect(resolveAssetUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg",
    );
    expect(resolveAssetUrl("http://cdn.example.com/a.jpg")).toBe(
      "http://cdn.example.com/a.jpg",
    );
    expect(resolveAssetUrl("blob:http://localhost/abc")).toBe(
      "blob:http://localhost/abc",
    );
    expect(resolveAssetUrl("data:image/png;base64,AAA")).toBe(
      "data:image/png;base64,AAA",
    );
  });

  it("keeps a stored path relative under the same-origin default", () => {
    /**
     * `baseURL` now defaults to a bare `/api/v1`, so `staticURL` is empty and
     * the path resolves against the page. That is the correct answer for a
     * same-origin deployment, and the dev server proxies `/uploads` so the file
     * is actually served. A split-origin build sets `VITE_API_URL`, which
     * `staticURL` derives from — the same code path, a different origin.
     */
    expect(resolveAssetUrl("/uploads/offers/abc.jpg")).toBe(
      "/uploads/offers/abc.jpg",
    );
  });

  it("tolerates a path with no leading slash", () => {
    expect(resolveAssetUrl("uploads/a.jpg")).toBe(resolveAssetUrl("/uploads/a.jpg"));
  });
});
