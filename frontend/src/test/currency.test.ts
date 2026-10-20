import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { formatCurrency } from "@/lib/core/utils";
import {
  getCurrency,
  setCurrency,
  currencyLabel,
  onCurrencyChange,
  __resetCurrencyForTests,
} from "@/lib/core/currency";

/**
 * The currency column on `business_settings` has existed since the beginning and
 * the settings screen has had a currency picker since the beginning, and for all
 * of that time `formatCurrency` printed `ج.م` unconditionally. An owner could
 * change the setting to SAR, save it, reload, and every price on every screen
 * stayed in Egyptian pounds. Nothing failed; the setting simply had no reader.
 *
 * These tests exist so that cannot come back silently. The hardcoded-label tests
 * are the part that matters most: a formatter that reads the setting is worth
 * nothing if half the prices on screen are still literal strings.
 */
describe("currency", () => {
  beforeEach(() => {
    __resetCurrencyForTests();
  });

  afterEach(() => {
    __resetCurrencyForTests();
  });

  describe("formatCurrency", () => {
    it("defaults to EGP, which is the backend column default", () => {
      expect(formatCurrency(100)).toBe("100.00 ج.م");
    });

    it("follows the salon's currency", () => {
      setCurrency("SAR");
      expect(formatCurrency(100)).toBe("100.00 ر.س");
      expect(formatCurrency(100)).not.toContain("ج.م");
    });

    it("keeps the currency after the number, not before", () => {
      // The reason `style: "currency"` is not used: browsers emit bidi markers
      // and reorder the symbol. A change here is the whole reason this helper
      // exists, and it fails silently -- the number is still right, it is just
      // on the wrong side of the cell in an RTL layout.
      setCurrency("USD");
      const rendered = formatCurrency(1234.5);
      expect(rendered.indexOf("1,234.50")).toBeLessThan(rendered.indexOf("$"));
    });

    it("always shows two decimal places", () => {
      expect(formatCurrency(10)).toBe("10.00 " + currencyLabel());
      expect(formatCurrency(10.5)).toBe("10.50 " + currencyLabel());
      expect(formatCurrency("10")).toBe("10.00 " + currencyLabel());
    });

    it("rounds a third decimal rather than truncating it", () => {
      // 10.005 -> 10.01, not 10.00. Truncating would quietly undercharge, and
      // the test that says otherwise is the test that would have been wrong:
      // an earlier version of this file asserted "10.00" and failed against
      // behaviour that is correct.
      expect(formatCurrency(10.005)).toBe("10.01 " + currencyLabel());
    });

    it("puts the minus sign in front, outside the number", () => {
      expect(formatCurrency(-50)).toBe("-50.00 " + currencyLabel());
    });

    it("accepts a string, because invoices arrive as decimals", () => {
      expect(formatCurrency("250.5")).toBe("250.50 " + currencyLabel());
    });

    it("survives a null or undefined total", () => {
      expect(formatCurrency(null)).toBe("0.00 " + currencyLabel());
      expect(formatCurrency(undefined)).toBe("0.00 " + currencyLabel());
    });

    it("an explicit code still overrides the salon setting", () => {
      setCurrency("EGP");
      // One consumer needs to render in the salon's currency while a report is
      // filtered to another; the parameter is the escape hatch for that.
      expect(formatCurrency(100, undefined, "USD")).toBe("100.00 $");
    });
  });

  describe("setCurrency", () => {
    it("reports whether anything changed", () => {
      expect(setCurrency("EGP")).toBe(false);
      expect(setCurrency("USD")).toBe(true);
      expect(setCurrency("usd")).toBe(false);
    });

    it("is case and whitespace insensitive", () => {
      setCurrency("  sar ");
      expect(getCurrency()).toBe("SAR");
    });

    it("falls back to EGP for an empty value rather than rendering nothing", () => {
      setCurrency("USD");
      setCurrency("");
      expect(getCurrency()).toBe("EGP");
      setCurrency(undefined);
      expect(getCurrency()).toBe("EGP");
    });

    it("keeps an unknown code, so the salon sees the code rather than the wrong currency", () => {
      // Better "100.00 XYZ" than "100.00 ج.م": one is obviously unconfigured, the
      // other is confidently wrong about the money.
      setCurrency("XYZ");
      expect(formatCurrency(100)).toBe("100.00 XYZ");
    });
  });

  describe("currencyLabel", () => {
    it("translates the currencies this app offers", () => {
      expect(currencyLabel("EGP")).toBe("ج.م");
      expect(currencyLabel("SAR")).toBe("ر.س");
      expect(currencyLabel("AED")).toBe("د.إ");
      expect(currencyLabel("USD")).toBe("$");
    });

    it("accepts an explicit code", () => {
      setCurrency("EGP");
      expect(currencyLabel("EUR")).toBe("€");
    });
  });

  describe("onCurrencyChange", () => {
    it("notifies on a real change and not on a no-op", () => {
      const seen: string[] = [];
      const stop = onCurrencyChange((code) => seen.push(code));
      setCurrency("USD");
      setCurrency("USD");
      setCurrency("SAR");
      stop();
      expect(seen).toEqual(["USD", "SAR"]);
    });

    it("unsubscribes", () => {
      let calls = 0;
      const stop = onCurrencyChange(() => {
        calls += 1;
      });
      setCurrency("USD");
      stop();
      setCurrency("SAR");
      expect(calls).toBe(1);
    });
  });
});
