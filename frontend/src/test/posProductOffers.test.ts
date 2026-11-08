import { describe, expect, it } from "vitest";
import {
  cartLineNeedsExpert,
  isProductOnlyOffer,
  offerAvailableUnits,
} from "@/features/pos/utils";

const offer = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  offer_products: [{ product_id: 10, quantity: 2 }],
  services: [],
  ...overrides,
});

describe("product offers", () => {
  it("recognises offers made only of products", () => {
    expect(isProductOnlyOffer(offer())).toBe(true);
    // A mixed offer still contains a service, so it is not retail stock.
    expect(isProductOnlyOffer(offer({ services: [{ id: 3 }] }))).toBe(false);
    // An offer with no products is not a product sale at all.
    expect(isProductOnlyOffer(offer({ offer_products: [] }))).toBe(false);
    expect(isProductOnlyOffer(null)).toBe(false);
  });

  it("limits a bundle by its tightest component", () => {
    const products = [
      { id: 10, quantity: 10 },
      { id: 11, quantity: 7 },
    ];
    const bundle = offer({
      offer_products: [
        { product_id: 10, quantity: 2 },
        { product_id: 11, quantity: 3 },
      ],
    });

    // min(floor(10 / 2), floor(7 / 3)) = min(5, 2).
    expect(offerAvailableUnits(bundle, products)).toBe(2);
  });

  it("reports zero when a component is missing from the catalogue", () => {
    const products = [{ id: 10, quantity: 10 }];
    const bundle = offer({
      offer_products: [
        { product_id: 10, quantity: 1 },
        { product_id: 99, quantity: 1 },
      ],
    });

    expect(offerAvailableUnits(bundle, products)).toBe(0);
  });

  it("never attributes retail lines to an expert", () => {
    expect(cartLineNeedsExpert({ type: "product" })).toBe(false);
    expect(cartLineNeedsExpert({ type: "offer", isProductOffer: true })).toBe(
      false,
    );
    expect(cartLineNeedsExpert({ type: "offer", isProductOffer: false })).toBe(
      true,
    );
    expect(cartLineNeedsExpert({ type: "service" })).toBe(true);
  });
});
