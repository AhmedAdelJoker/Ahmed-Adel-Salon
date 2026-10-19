import { describe, it, expect } from "vitest";
import {
  SERVICE_PROVIDER_JOB_TITLES,
  isServiceProviderJobTitle,
} from "@/features/hr/utils/helpers";
import {
  JOB_TITLES,
  JOB_TITLE_BLUEPRINTS,
  isFormStepVisible,
} from "@/features/hr/utils/constants";

/**
 * Who counts as a service provider — the frontend twin of
 * `SERVICE_PROVIDER_JOB_TITLES` in `backend/app/core/employee_rules.py`.
 *
 * The backend enforces the classification (a non-provider can never have the
 * online-booking switch on); this constant decides what the UI offers. If the
 * two lists drift, the form either hides a switch the server would keep, or
 * shows one the server silently drops.
 */
describe("who is a service provider", () => {
  it("lists exactly the customer-facing service titles", () => {
    expect(SERVICE_PROVIDER_JOB_TITLES).toEqual([
      "barber",
      "colorist",
      "esthetician",
    ]);
  });

  it("accepts every provider title", () => {
    for (const title of SERVICE_PROVIDER_JOB_TITLES) {
      expect(isServiceProviderJobTitle(title), title).toBe(true);
    }
  });

  it("rejects admin, support and assistant titles", () => {
    for (const title of [
      "accountant",
      "cashier",
      "manager",
      "owner",
      "barber_assistant",
      "receptionist",
      "cleaner",
      "other",
      "",
      null,
      undefined,
    ]) {
      expect(isServiceProviderJobTitle(title), String(title)).toBe(false);
    }
  });

  it("is case- and whitespace-tolerant", () => {
    expect(isServiceProviderJobTitle(" BARBER ")).toBe(true);
    expect(isServiceProviderJobTitle("Colorist")).toBe(true);
  });
});

describe("the job title list uses real barbershop titles", () => {
  it("offers the core barbershop roles", () => {
    const values = JOB_TITLES.map((t) => t.value);
    for (const title of ["barber", "colorist", "esthetician", "barber_assistant"]) {
      expect(values, title).toContain(title);
    }
  });

  it("no longer offers the borrowed 'كوافير' title", () => {
    const labels = JOB_TITLES.map((t) => t.label);
    expect(labels).not.toContain("كوافير");
    expect(JOB_TITLES.map((t) => t.value)).not.toContain("hairstylist");
    expect(JOB_TITLE_BLUEPRINTS.hairstylist).toBeUndefined();
  });

  it("asks for the skills step for the service roles", () => {
    for (const title of ["barber", "colorist", "esthetician"]) {
      expect(isFormStepVisible("skills", title), title).toBe(true);
    }
  });
});
