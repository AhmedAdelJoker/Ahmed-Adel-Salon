import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Media URLs, and the two ways they used to break.
 *
 * 1. The stored value is already the full path (`/uploads/profiles/<id>.jpg`).
 *    `EmployeeAvatar` used to prefix it with `/uploads` again, producing
 *    `/uploads/uploads/profiles/<id>.jpg` -- a path the server does not serve,
 *    so every avatar silently fell back to initials. The employee was
 *    photographable the whole time; the URL was the problem.
 *
 * 2. The backend sends `Cross-Origin-Resource-Policy: same-site` in
 *    development. That is right for `localhost:5173` loading `localhost:8000`,
 *    but the *dev server proxies* `/uploads`, so a relative path is both
 *    same-origin and proxied -- and a split-host absolute URL
 *    (`127.0.0.1:8000` under a `localhost:5173` page) is a different site,
 *    which the browser blocks with `ERR_BLOCKED_BY_RESPONSE.NotSameSite`.
 *    The address therefore has to follow the protocol, not the user agent:
 *    `file:` (the packaged desktop app) needs an absolute backend address;
 *    every page served over http(s) resolves `/api` against its own origin.
 */
const SRC = join(__dirname, "..");

describe("employee media URLs", () => {
  it("EmployeeAvatar does not prefix /uploads onto a stored path", () => {
    const text = readFileSync(
      join(SRC, "components/shared/EmployeeAvatar.tsx"),
      "utf8",
    );
    // The double-prefix that broke every avatar.
    expect(text).not.toMatch(/\$\{base\}\/uploads\$\{imageUrl\}/);
    expect(text).not.toMatch(/\/uploads\$\{imageUrl\}/);
    // ...and the single resolver everything else uses.
    expect(text).toMatch(/resolveAssetUrl/);
  });

  it("EmployeePhoto resolves through the same helper", () => {
    const text = readFileSync(
      join(SRC, "components/shared/EmployeePhoto.tsx"),
      "utf8",
    );
    expect(text).toMatch(/resolveAssetUrl/);
  });

  it("the api client decides the backend address by protocol, not user agent", () => {
    const text = readFileSync(join(SRC, "services/api.ts"), "utf8");
    // A user-agent sniff misfires in any Electron-based browser (an IDE
    // webview, a desktop wrapper) that is served over http, and produces an
    // absolute cross-site address that the CORP header then blocks.
    expect(text).not.toMatch(/navigator\.userAgent\.includes\("Electron"\)/);
    expect(text).toMatch(/window\.location\.protocol === "file:"/);
  });

  it("the backend scopes CORP to same-site in development", () => {
    const text = readFileSync(
      join(SRC, "../../backend/app/main.py"),
      "utf8",
    );
    expect(text).toMatch(/Cross-Origin-Resource-Policy/);
    // `same-origin` in development would block every image loaded from the
    // dev server; the header is deliberately `same-site` there.
    expect(text).toMatch(/same-site/);
  });

  it("the uploads are served with cross-origin, the API stays strict", () => {
    const text = readFileSync(
      join(SRC, "../../backend/app/main.py"),
      "utf8",
    );
    // An uploaded photo is public media that a split-origin deployment, the
    // desktop app on `file://` and the test preview all fetch from another
    // origin. `same-origin`/`same-site` block all three with
    // ERR_BLOCKED_BY_RESPONSE.NotSameOrigin/NotSameSite, and the image never
    // arrives -- the UI falls back to initials, which reads as "no photo".
    expect(text).toMatch(/startswith\("\/uploads"\)[\s\S]{0,200}cross-origin/);
    // Every other response keeps the strict value.
    expect(text).toMatch(/elif settings\.ENVIRONMENT == "production"[\s\S]{0,200}same-origin/);
  });
});
