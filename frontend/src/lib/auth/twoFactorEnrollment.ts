/**
 * Mandatory two-factor enrolment state.
 *
 * One module, because three different places need to agree on the answer: the
 * router decides whether to redirect, the settings panel decides whether to nag,
 * and the API layer needs to know that a 403 is this and not a permissions
 * problem. Three copies of `localStorage.getItem("2fa_enrollment_required") ===
 * "true"` is three chances to spell it differently.
 *
 * The source of truth is a localStorage flag written by the login response, not
 * anything derived from the user's role. Deriving it client-side would mean the
 * frontend had to carry its own copy of the role list, and would disagree with
 * the backend the moment someone changed `TOTP_REQUIRED_ROLES` -- showing a
 * block to a cashier, or staying silent for an owner. The server decides; this
 * only remembers what it said.
 *
 * This is a UX affordance and nothing more. The enforcement is the 403 that
 * `authenticate_access_token` returns for a restricted scope, and it does not
 * depend on anything in this file. Clearing localStorage must not grant access;
 * it can only make a correctly-locked user see a page that fails, which is the
 * safe direction to fail in.
 */

export const ENROLLMENT_REQUIRED_KEY = "2fa_enrollment_required";
export const ENROLLMENT_DUE_KEY = "2fa_enrollment_due";

/** The settings tab that hosts the enrolment panel. */
export const ENROLLMENT_ROUTE = "/settings?tab=security";

/** True when the session is restricted to the two enrolment endpoints. */
export function needsTwoFactorEnrollment(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ENROLLMENT_REQUIRED_KEY) === "true";
  } catch {
    // Private browsing, a blocked storage partition, or a corrupt profile. Not
    // worth failing navigation over: the backend still refuses every other
    // route, so returning false here means a broken-looking page rather than an
    // open door.
    return false;
  }
}

/**
 * The deadline after which this account's session becomes restricted, if the
 * server sent one. Null when the account is exempt or already enrolled.
 */
export function twoFactorEnrollmentDeadline(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENROLLMENT_DUE_KEY);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/** True while the account is still inside its grace period. */
export function isWithinEnrollmentGracePeriod(): boolean {
  const deadline = twoFactorEnrollmentDeadline();
  return deadline !== null && deadline.getTime() > Date.now();
}

/** Clears the restriction. Called after a successful enrolment. */
export function clearTwoFactorEnrollment(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ENROLLMENT_REQUIRED_KEY);
    window.localStorage.removeItem(ENROLLMENT_DUE_KEY);
  } catch {
    // Nothing useful to do. The next successful login rewrites these from the
    // server's answer, so a failure here is self-healing.
  }
}
