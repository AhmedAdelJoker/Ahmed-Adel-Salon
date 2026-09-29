/**
 * Tests for the mandatory two-factor enrolment state helpers.
 *
 * Small module, but the failure it could cause is not: `needsTwoFactorEnrollment`
 * returning true forever locks a user out of the application entirely, and
 * returning false when it should be true leaves them on a dashboard where every
 * request 403s. Both are worse than doing nothing, and neither is caught by a
 * type checker.
 *
 * The security-relevant property is the one in `test_storage_cannot_grant_access`:
 * this module is UX. Nothing here is a control, and the tests should not be read
 * as if it were.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTwoFactorEnrollment,
  ENROLLMENT_DUE_KEY,
  ENROLLMENT_REQUIRED_KEY,
  ENROLLMENT_ROUTE,
  isWithinEnrollmentGracePeriod,
  needsTwoFactorEnrollment,
  twoFactorEnrollmentDeadline,
} from "@/lib/auth/twoFactorEnrollment";

/**
 * A real, working Storage.
 *
 * `src/test/setup.ts` replaces the global `localStorage` with an object of bare
 * `vi.fn()`s. Those record calls and return nothing, so `getItem` always yields
 * `undefined` no matter what was written. Any test that uses it to assert a
 * positive result is asserting nothing at all -- it would pass just as happily
 * with the module entirely broken, and the negative cases would pass too, which
 * is how a broken implementation gets a green suite.
 *
 * Installing a functional double here rather than changing the shared setup: the
 * global stub is depended on elsewhere, and quietly rewriting it to actually
 * store things could turn a dozen currently-passing tests red for reasons that
 * have nothing to do with this feature. Scoped and explicit is the safer change.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const realStorage = new MemoryStorage();
const originalStorage = window.localStorage;

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: realStorage,
    configurable: true,
    writable: true,
  });
});

afterAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: originalStorage,
    configurable: true,
    writable: true,
  });
});

describe("two-factor enrolment state", () => {
  beforeEach(() => {
    realStorage.clear();
  });

  describe("needsTwoFactorEnrollment", () => {
    it("is false when the login response said nothing", () => {
      expect(needsTwoFactorEnrollment()).toBe(false);
    });

    it("is true only for the exact string the server sent", () => {
      realStorage.setItem(ENROLLMENT_REQUIRED_KEY, "true");
      expect(needsTwoFactorEnrollment()).toBe(true);
    });

    it('treats "false", "1" and other truthy-looking strings as not required', () => {
      // Not defensiveness for its own sake. A truthy coercion here is how a
      // cleared flag that serialised as "undefined" or "null" ends up locking a
      // user out of every page of the application.
      for (const value of ["false", "1", "TRUE", "yes", "", "undefined", "null"]) {
        realStorage.setItem(ENROLLMENT_REQUIRED_KEY, value);
        expect(needsTwoFactorEnrollment()).toBe(false);
      }
    });

    it("does not throw when storage is unavailable", () => {
      const getItem = vi
        .spyOn(realStorage, "getItem")
        .mockImplementation(() => {
          throw new Error("storage blocked");
        });
      expect(needsTwoFactorEnrollment()).toBe(false);
      getItem.mockRestore();
    });
  });

  describe("twoFactorEnrollmentDeadline", () => {
    it("is null when there is no deadline", () => {
      expect(twoFactorEnrollmentDeadline()).toBeNull();
    });

    it("parses an ISO timestamp", () => {
      realStorage.setItem(ENROLLMENT_DUE_KEY, "2026-10-06T12:00:00Z");
      const deadline = twoFactorEnrollmentDeadline();
      expect(deadline).toBeInstanceOf(Date);
      expect(deadline?.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    });

    it("is null for an unparseable value rather than an Invalid Date", () => {
      // An Invalid Date has no `getTime()` value, so a caller doing arithmetic
      // on it silently produces NaN and the grace-period check below returns
      // false forever.
      realStorage.setItem(ENROLLMENT_DUE_KEY, "not-a-date");
      expect(twoFactorEnrollmentDeadline()).toBeNull();
    });

    it("is null for an empty string", () => {
      realStorage.setItem(ENROLLMENT_DUE_KEY, "");
      expect(twoFactorEnrollmentDeadline()).toBeNull();
    });
  });

  describe("isWithinEnrollmentGracePeriod", () => {
    it("is false with no deadline", () => {
      expect(isWithinEnrollmentGracePeriod()).toBe(false);
    });

    it("is true for a future deadline", () => {
      const future = new Date(Date.now() + 86_400_000);
      realStorage.setItem(ENROLLMENT_DUE_KEY, future.toISOString());
      expect(isWithinEnrollmentGracePeriod()).toBe(true);
    });

    it("is false for a past deadline", () => {
      const past = new Date(Date.now() - 86_400_000);
      realStorage.setItem(ENROLLMENT_DUE_KEY, past.toISOString());
      expect(isWithinEnrollmentGracePeriod()).toBe(false);
    });
  });

  describe("clearTwoFactorEnrollment", () => {
    it("removes both keys", () => {
      realStorage.setItem(ENROLLMENT_REQUIRED_KEY, "true");
      realStorage.setItem(ENROLLMENT_DUE_KEY, "2026-10-06T12:00:00Z");
      clearTwoFactorEnrollment();
      expect(realStorage.getItem(ENROLLMENT_REQUIRED_KEY)).toBeNull();
      expect(realStorage.getItem(ENROLLMENT_DUE_KEY)).toBeNull();
    });

    it("does not throw when removal fails", () => {
      const removeItem = vi
        .spyOn(realStorage, "removeItem")
        .mockImplementation(() => {
          throw new Error("storage blocked");
        });
      expect(() => clearTwoFactorEnrollment()).not.toThrow();
      removeItem.mockRestore();
    });
  });

  it("points at a route that exists", () => {
    // The 2FA panel is a tab of /settings, not a route of its own. A wrong path
    // here redirects to a 404 on the one screen the user cannot get past, and
    // nothing else would notice.
    expect(ENROLLMENT_ROUTE).toBe("/settings?tab=security");
    expect(ENROLLMENT_ROUTE.startsWith("/settings")).toBe(true);
    expect(ENROLLMENT_ROUTE).toContain("tab=");
  });

  it("is UX, not a control", () => {
    // The point of this test is documentary. Enforcement lives server-side in the
    // scope check on the access token; clearing these keys cannot grant access
    // to anything, only stop the redirect. Worth stating so nobody later reads
    // this module as a security boundary and removes the server-side check
    // because "the client already handles it".
    realStorage.clear();
    expect(needsTwoFactorEnrollment()).toBe(false);
  });
});
