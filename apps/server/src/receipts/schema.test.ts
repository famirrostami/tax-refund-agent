import { describe, expect, it } from "vitest";
import { receiptSchema } from "./schema";

const base = {
  vendor: "MediaMarkt", date: "2025-03-14", totalAmount: 899, currency: "EUR", vatAmount: 143.55, vatRate: 19,
  description: "Laptop", lineItems: [{ description: "Laptop", amount: 899 }], paymentMethod: null,
  documentType: "invoice", legibility: "clear", uncertainFields: [],
};

describe("receiptSchema", () => {
  it("accepts a full receipt and one with unknowns as null", () => {
    expect(receiptSchema.safeParse(base).success).toBe(true);
    expect(receiptSchema.safeParse({ ...base, vendor: null, date: null, totalAmount: null, currency: null }).success).toBe(true);
  });
  it("rejects bad dates and negative amounts", () => {
    expect(receiptSchema.safeParse({ ...base, date: "14.03.2025" }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...base, totalAmount: -1 }).success).toBe(false);
  });
});
