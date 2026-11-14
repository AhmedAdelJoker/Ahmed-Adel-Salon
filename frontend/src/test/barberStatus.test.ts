/**
 * The barber status module is a copy of the backend's transition table.
 *
 * That copy is the risk: if the two drift, the UI offers a button for a move the
 * API rejects with 409, and the barber finds out by tapping it. So the table is
 * asserted here against the same values the backend enforces.
 */
import { describe, expect, it } from "vitest";

import {
  BARBER_TRANSITIONS,
  STATUS_LABELS,
  allowedTransitions,
  canonicalStatus,
  isTerminal,
  statusChangeMessage,
  statusLabel,
  statusVariant,
} from "@/lib/barberStatus";

/** Mirrors `_BARBER_TRANSITIONS` in backend/app/api/v1/endpoints/barber.py. */
const BACKEND_TRANSITIONS: Record<string, string[]> = {
  pending: ["in-service", "waiting", "confirmed", "cancelled", "no_show"],
  confirmed: ["in-service", "waiting", "cancelled", "no_show"],
  waiting: ["in-service", "confirmed", "cancelled", "no_show"],
  "in-service": ["ready_for_payment", "cancelled"],
  in_progress: ["ready_for_payment", "cancelled"],
  ready_for_payment: [],
  completed: [],
  done: [],
  cancelled: [],
  no_show: [],
};

describe("transition table matches the backend", () => {
  it("has exactly the statuses the backend declares", () => {
    expect(Object.keys(BARBER_TRANSITIONS).sort()).toEqual(
      Object.keys(BACKEND_TRANSITIONS).sort(),
    );
  });

  it.each(Object.keys(BACKEND_TRANSITIONS))(
    "allows the same moves out of %s",
    (status) => {
      expect([...allowedTransitions(status)].sort()).toEqual(
        [...BACKEND_TRANSITIONS[status]].sort(),
      );
    },
  );

  it("never allows leaving a terminal status", () => {
    for (const [status, targets] of Object.entries(BARBER_TRANSITIONS)) {
      if (targets.length === 0) {
        expect(isTerminal(status)).toBe(true);
      } else {
        expect(isTerminal(status)).toBe(false);
      }
    }
  });

  it("does not offer the UI an alias the API does not accept", () => {
    // The UI sends canonical values. `completed` is an *inbound* alias the API
    // maps to ready_for_payment, so offering it as a target would be relying on
    // a translation layer rather than on the transition table.
    const offered = Object.values(BARBER_TRANSITIONS).flat();
    expect(offered).not.toContain("completed");
  });
});

describe("canonicalStatus", () => {
  it("maps the completed alias onto the stored value", () => {
    expect(canonicalStatus("completed")).toBe("ready_for_payment");
  });

  it("leaves canonical values alone", () => {
    expect(canonicalStatus("in-service")).toBe("in-service");
    expect(canonicalStatus("waiting")).toBe("waiting");
  });

  it("treats a missing status as pending rather than throwing", () => {
    expect(canonicalStatus(null)).toBe("pending");
    expect(canonicalStatus(undefined)).toBe("pending");
    expect(canonicalStatus("")).toBe("pending");
  });
});

describe("labels and variants", () => {
  it("labels every status the API can store", () => {
    for (const status of Object.keys(BARBER_TRANSITIONS)) {
      expect(statusLabel(status)).not.toBe(status);
    }
  });

  it("has a variant for every status the API can store", () => {
    for (const status of Object.keys(BARBER_TRANSITIONS)) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(statusVariant(status)).toBeTruthy();
    }
  });

  it("falls back rather than rendering undefined for an unknown status", () => {
    // A status the backend does not know must not blank the badge.
    expect(statusLabel("martian")).toBe("martian");
    expect(statusVariant("martian")).toBe("secondary");
  });

  it("marks a cancellation as danger, not success", () => {
    // The two hand-rolled controls this replaced fell through to a final `else`
    // that rendered a green "مكتمل" tick for every non-waiting status, which is
    // how a cancelled appointment came to look finished.
    expect(statusVariant("cancelled")).toBe("danger");
    expect(statusVariant("no_show")).toBe("danger");
    expect(statusVariant("ready_for_payment")).toBe("success");
  });
});

describe("statusChangeMessage", () => {
  const errorWith = (status: number, detail?: string) => ({
    response: { status, data: detail ? { detail } : {} },
  });

  it("does not tell the barber to retry an illegal transition", () => {
    const msg = statusChangeMessage(
      errorWith(409, "لا يمكن الانتقال من 'ready_for_payment' إلى 'in-service'"),
    );
    expect(msg).not.toContain("أعد المحاولة");
    expect(msg).toMatch(/غير متاحة/);
  });

  it("surfaces the allowed moves, from the backend's real Arabic detail", () => {
    // The exact shape `update_service_status` builds. An earlier version of this
    // matcher looked for an English `allowed:` and silently never matched.
    const detail =
      "لا يمكن الانتقال من 'ready_for_payment' إلى 'in-service'. " +
      "المسموح: لا شيء";
    const msg = statusChangeMessage(errorWith(409, detail));
    expect(msg).toContain("المسموح");
    expect(msg).toContain("لا شيء");
  });

  it("surfaces a populated allowed list", () => {
    const detail =
      "لا يمكن الانتقال من 'ready_for_payment' إلى 'waiting'. " +
      "المسموح: in-service, cancelled";
    expect(statusChangeMessage(errorWith(409, detail))).toContain(
      "in-service, cancelled",
    );
  });

  it("does not tell the barber to retry an unknown status", () => {
    expect(statusChangeMessage(errorWith(422))).toMatch(/غير معروفة/);
  });

  it("keeps the retry advice for a genuine transient failure", () => {
    expect(statusChangeMessage(errorWith(500))).toContain("أعد المحاولة");
    expect(statusChangeMessage(new Error("network"))).toContain("أعد المحاولة");
    expect(statusChangeMessage(undefined)).toContain("أعد المحاولة");
  });
});