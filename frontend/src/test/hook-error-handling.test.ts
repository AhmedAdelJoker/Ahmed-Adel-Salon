import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..");
const FEATURES = join(SRC, "features");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const hookFiles = walk(FEATURES).filter((f) => /[\\/]hooks[\\/]/.test(f));

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Catch blocks whose body contains nothing but console calls.
 *
 * Statements are split on `;` rather than matched with one big regex, because
 * a greedy pattern happily swallows a trailing `toast.error(...)` and reports a
 * handled catch as silent.
 */
function consoleOnlyCatches(code: string): number {
  let count = 0;
  for (const match of code.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g)) {
    const statements = match[1]
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statements.length === 0) continue;
    if (statements.every((s) => s.startsWith("console."))) count += 1;
  }
  return count;
}

describe("feature hooks surface load failures", () => {
  it("has hooks to check", () => {
    expect(hookFiles.length).toBeGreaterThan(20);
  });

  it("never swallows a catch into console alone without an error channel", () => {
    // A hook that catches, logs and returns leaves the page rendering an empty
    // shell. That reads as "nothing to do" rather than "the request failed",
    // and gives the user no reason to retry. Each entry below is a background
    // or secondary call whose failure must not blank or block the page, with
    // the reason it is safe to stay quiet.
    const ALLOWED = new Set([
      // WebSocket payloads are not a page-load signal; a malformed frame should
      // not blank the screen. The connection itself is covered by the socket
      // context, and every mutation still toasts.
      "barber-dashboard/hooks/useBarberDashboard.ts",
      "barber-workstation/hooks/useBarberWorkStation.ts",
      "customers/hooks/useCustomerDialogs.tsx",
      "pos/hooks/usePOSLogic.ts",
      "schedule/hooks/useSchedule.tsx",
      "cashier-dashboard/hooks/useCashierDashboard.ts",
      // Remaining console-only catches are the malformed-frame handler, the
      // duplicate-name advisory and the auto-cancel-expired maintenance call.
      // The list itself loads through TanStack Query, which carries its own
      // error state, and the slot and conflict checks now surface.
      "bookings/hooks/useBookingsData.ts",
      "bookings/hooks/useBookingsBoard.ts",
      // Employee form validation save, and the shift-grace-period write that
      // mirrors a rule into business settings. Both are secondary writes whose
      // primary path already toasts.
      "hr/hooks/useEmployeeForm.ts",
      "inventory/hooks/useInventoryData.ts",
      "pos/hooks/usePOSShift.ts",
      "financial-rules/hooks/useFinancialRules.ts",
      // Ingredient picker data and the employee document list. Both are
      // supplementary to the page's primary record, and both leave the primary
      // content intact on failure.
      "catalog/hooks/useCatalogData.ts",
      "hr/hooks/useEmployeeDocuments.ts",
    ]);

    const offenders: string[] = [];
    for (const file of hookFiles) {
      const rel = relative(FEATURES, file).replace(/\\/g, "/");
      if (ALLOWED.has(rel)) continue;

      const code = stripComments(readFileSync(file, "utf8"));
      const silent = consoleOnlyCatches(code);
      if (silent > 0) {
        offenders.push(`${rel}: ${silent} console-only catch(es)`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("error state is rendered", () => {
  it("exposes an error field from every hook that sets one", () => {
    // Catches the case where a hook grows `setError(...)` but forgets to return
    // it, which would leave the page unable to show anything.
    const offenders: string[] = [];
    for (const file of hookFiles) {
      const rel = relative(FEATURES, file).replace(/\\/g, "/");
      const code = stripComments(readFileSync(file, "utf8"));
      if (!/set(LoadError|Error|SecondaryError|AdjustmentsError|StatsError|CatalogError|ShiftError)\(/.test(code))
        continue;
      if (!/\berror[A-Za-z]*,|\b(loadError|secondaryError|adjustmentsError|statsError|catalogError|shiftError|readyAppointmentsError),/.test(code)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
