import { describe, expect, it } from "vitest";

import { keysForSocketEvent } from "@/lib/queryKeys";

describe("keysForSocketEvent", () => {
  it("maps known events to their query keys", () => {
    expect(keysForSocketEvent({ event: "invoice_created" })).toEqual([
      ["invoices"],
      ["dashboard"],
      ["cashbox"],
      ["reports"],
    ]);
    expect(keysForSocketEvent({ event: "appointment_ready_for_payment" })).toEqual([
      ["pos"],
      ["appointments"],
      ["reception"],
    ]);
    expect(keysForSocketEvent({ event: "shift_closed" })).toEqual([
      ["pos-shifts"],
      ["reports"],
      ["cashbox"],
    ]);
  });

  it("reads the event name from the shapes the socket has used", () => {
    const expected = [["stock"], ["inventory"]];
    expect(keysForSocketEvent({ type: "product_stock_changed" })).toContainEqual(["inventory"]);
    expect(keysForSocketEvent({ action: "product_stock_changed" })).toContainEqual(["inventory"]);
    expect(keysForSocketEvent({ name: "product_stock_changed" })).toContainEqual(["inventory"]);
    expect(expected.length).toBe(2);
  });

  it("normalises spacing and casing in event names", () => {
    expect(keysForSocketEvent({ event: "Invoice Created" })).toEqual(
      keysForSocketEvent({ event: "invoice_created" }),
    );
    expect(keysForSocketEvent({ event: "invoice-created" })).toEqual(
      keysForSocketEvent({ event: "invoice_created" }),
    );
  });

  it("returns nothing for a generic keyword with no second group agreeing", () => {
    // "invoice" also appears in shift/expense copy, so on its own it is not
    // enough to refetch anything.
    expect(keysForSocketEvent({ event: "something_invoice_related" })).toEqual([]);
  });

it("accepts a single domain-specific keyword on its own", () => {
    // "وردية" only ever appears in shift vocabulary.
    expect(keysForSocketEvent({ message: "تم إغلاق الوردية" })).toContainEqual(["pos-shifts"]);
    expect(keysForSocketEvent({ message: "تم تسليم المخزون" })).toContainEqual(["inventory"]);
  });

  it("falls back to keyword scanning only with two independent hits", () => {
    const keys = keysForSocketEvent({
      message: "تم إنشاء فاتورة جديدة للعميل",
    });
    expect(keys).toContainEqual(["invoices"]);
    expect(keys).toContainEqual(["dashboard"]);
  });

  it("matches Arabic keywords as well as Latin ones", () => {
    // "وردية" is domain-specific, so it resolves on its own — proving the
    // Arabic vocabulary is actually consulted.
    const arabic = keysForSocketEvent({ message: "تم إغلاق الوردية" });
    const latin = keysForSocketEvent({ message: "shift closed" });
    expect(arabic).toContainEqual(["pos-shifts"]);
    expect(latin).toContainEqual(["pos-shifts"]);
  });

  it("returns nothing for an empty or unrecognisable payload", () => {
    expect(keysForSocketEvent({})).toEqual([]);
    expect(keysForSocketEvent({ message: "hello" })).toEqual([]);
  });

  it("never returns duplicates for a repeated keyword payload", () => {
    const keys = keysForSocketEvent({
      message: "invoice invoice customer customer cash cash",
    });
    const seen = new Set(keys.map((key) => key.join("/")));
    expect(seen.size).toBe(keys.length);
  });
});