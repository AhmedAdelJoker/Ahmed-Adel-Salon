import { describe, it, expect } from "vitest";
import {
  computeCategoryShares,
  computeReorderSuggestion,
  isLowStock,
  OTHER_CATEGORY,
} from "@/features/inventory/insights";

describe("computeCategoryShares", () => {
  it("returns shares that sum to 1", () => {
    const shares = computeCategoryShares([
      { category: "زيوت", count: 2, value: 100, cost: 40 },
      { category: "cream", count: 1, value: 60, cost: 20 },
      { category: "شامبو", count: 1, value: 40, cost: 10 },
    ]);
    expect(shares).toHaveLength(3);
    expect(shares.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 6);
    expect(shares[0].category).toBe("زيوت");
  });

  it("merges everything past the slice cap into " + OTHER_CATEGORY, () => {
    const shares = computeCategoryShares(
      [
        { category: "a", count: 1, value: 100, cost: 0 },
        { category: "b", count: 2, value: 80, cost: 0 },
        { category: "c", count: 3, value: 60, cost: 0 },
        { category: "d", count: 4, value: 40, cost: 0 },
        { category: "e", count: 5, value: 20, cost: 0 },
        { category: "f", count: 6, value: 10, cost: 0 },
      ],
      4,
    );
    expect(shares).toHaveLength(5);
    const other = shares.find((s) => s.category === OTHER_CATEGORY);
    expect(other).toBeDefined();
    expect(other!.count).toBe(11);
    expect(other!.value).toBe(30);
  });

  it("drops empty and zero-value categories", () => {
    const shares = computeCategoryShares([
      { category: "", count: 1, value: 0, cost: 0 },
      { category: "real", count: 1, value: 10, cost: 1 },
    ]);
    expect(shares.map((s) => s.category)).toEqual(["real"]);
  });

  it("returns an empty array for a shelf with no value", () => {
    expect(computeCategoryShares([])).toEqual([]);
    expect(
      computeCategoryShares([
        { category: "a", count: 1, value: 0, cost: 0 },
      ]),
    ).toEqual([]);
  });
});

describe("isLowStock", () => {
  it("is true at or below the threshold, including zero stock", () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(0, 0)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

describe("computeReorderSuggestion", () => {
  it("suggests enough to reach twice the threshold", () => {
    expect(computeReorderSuggestion(0, 4)).toBe(8);
    expect(computeReorderSuggestion(1, 4)).toBe(7);
    expect(computeReorderSuggestion(5, 4)).toBe(3);
  });

  it("suggests nothing for an out-of-stock line already above the threshold", () => {
    expect(computeReorderSuggestion(8, 4)).toBe(0);
    expect(computeReorderSuggestion(20, 4)).toBe(0);
  });

  it("suggests nothing when the product is not monitored", () => {
    expect(computeReorderSuggestion(0, 0)).toBe(0);
    expect(computeReorderSuggestion(3, undefined as unknown as number)).toBe(0);
  });
});
