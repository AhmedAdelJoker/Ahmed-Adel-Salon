import { describe, expect, it, vi, afterEach } from "vitest";
import type { TrendPoint } from "@/types/reports";
import {
  detectAnomalies,
  downloadCsvFile,
  lastNMonthKeys,
  meanStd,
  monthKeyOf,
  monthLabelAr,
  pctGrowth,
} from "@/lib/money/financialAnalytics";

const point = (date: string, rev: number, exp: number): TrendPoint => ({
  name: date,
  date,
  label: date.slice(5),
  rev,
  exp,
  net: rev - exp,
});

describe("pctGrowth", () => {
  it("computes positive growth", () => {
    expect(pctGrowth(125, 100)).toBeCloseTo(25);
  });

  it("computes negative growth", () => {
    expect(pctGrowth(80, 100)).toBeCloseTo(-20);
  });

  it("returns null when baseline is zero or negative", () => {
    expect(pctGrowth(100, 0)).toBeNull();
    expect(pctGrowth(100, -50)).toBeNull();
  });

  it("returns null for non-finite inputs", () => {
    expect(pctGrowth(Number.NaN, 100)).toBeNull();
    expect(pctGrowth(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("meanStd", () => {
  it("returns zeros for empty input", () => {
    expect(meanStd([])).toEqual({ mean: 0, std: 0 });
  });

  it("computes mean and population std-dev", () => {
    const { mean, std } = meanStd([10, 20, 30]);
    expect(mean).toBeCloseTo(20);
    expect(std).toBeCloseTo(8.1649658, 4);
  });
});

describe("detectAnomalies", () => {
  it("returns empty for short series", () => {
    expect(detectAnomalies([point("2026-09-01", 100, 50)])).toEqual([]);
  });

  it("returns empty for a stable series", () => {
    const trends = Array.from({ length: 10 }, (_, i) =>
      point(`2026-09-${String(i + 1).padStart(2, "0")}`, 1000, 400),
    );
    expect(detectAnomalies(trends)).toEqual([]);
  });

  it("flags a revenue spike", () => {
    const trends = Array.from({ length: 9 }, (_, i) =>
      point(`2026-09-${String(i + 1).padStart(2, "0")}`, 1000, 400),
    );
    trends.push(point("2026-09-10", 20000, 400));
    const found = detectAnomalies(trends).filter((a) => a.kind === "rev_spike");
    expect(found).toHaveLength(1);
    expect(found[0].date).toBe("2026-09-10");
  });

  it("flags an expense spike via the 3x median rule", () => {
    const trends = Array.from({ length: 9 }, (_, i) =>
      point(`2026-09-${String(i + 1).padStart(2, "0")}`, 1000, 100),
    );
    trends.push(point("2026-09-10", 1000, 500));
    const found = detectAnomalies(trends).filter((a) => a.kind === "exp_spike");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("high");
  });

  it("flags a deep net drop", () => {
    const trends = Array.from({ length: 9 }, (_, i) =>
      point(`2026-09-${String(i + 1).padStart(2, "0")}`, 1000, 500),
    );
    trends.push(point("2026-09-10", 0, 6000));
    const found = detectAnomalies(trends).filter((a) => a.kind === "net_drop");
    expect(found).toHaveLength(1);
    expect(found[0].date).toBe("2026-09-10");
  });

  it("caps results at 6 anomalies", () => {
    const trends = Array.from({ length: 30 }, (_, i) =>
      point(`2026-08-${String(i + 1).padStart(2, "0")}`, 1000, i % 2 === 0 ? 100 : 9000),
    );
    expect(detectAnomalies(trends).length).toBeLessThanOrEqual(6);
  });
});

describe("month helpers", () => {
  it("monthKeyOf extracts YYYY-MM", () => {
    expect(monthKeyOf("2026-09-14")).toBe("2026-09");
    expect(monthKeyOf("2026-09")).toBe("2026-09");
    expect(monthKeyOf("abc")).toBe("");
  });

  it("monthLabelAr renders Arabic month names", () => {
    expect(monthLabelAr("2026-09")).toBe("سبتمبر 2026");
    expect(monthLabelAr("2026-01")).toBe("يناير 2026");
    expect(monthLabelAr("invalid")).toBe("invalid");
  });

  it("lastNMonthKeys returns ascending keys ending this month", () => {
    const keys = lastNMonthKeys(3);
    expect(keys).toHaveLength(3);
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(keys[2]).toBe(current);
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("downloadCsvFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("triggers a download with BOM + headers and .csv extension", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const createdAnchors: HTMLAnchorElement[] = [];
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, options?: ElementCreationOptions) => {
      const el = realCreateElement(tag, options);
      if (tag === "a") {
        const anchor = el as HTMLAnchorElement;
        vi.spyOn(anchor, "click").mockImplementation(() => undefined);
        createdAnchors.push(anchor);
      }
      return el;
    }) as typeof document.createElement);

    downloadCsvFile("day_detail_2026-09-14", ["التاريخ", "المبلغ"], [["2026-09-14", 1500]]);

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    // BOM must be present in the raw bytes (TextDecoder strips it on .text())
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = await blob.text();
    expect(text).toContain("التاريخ,المبلغ");
    expect(text).toContain("2026-09-14,1500");
    expect(createdAnchors).toHaveLength(1);
    expect(createdAnchors[0].getAttribute("download")).toBe("day_detail_2026-09-14.csv");
    expect(createdAnchors[0].click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});
