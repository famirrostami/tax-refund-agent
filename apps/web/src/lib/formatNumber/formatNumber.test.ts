import { describe, expect, it } from "vitest";
import { formatNumber } from "./formatNumber";

describe("formatNumber", () => {
  it("formats with the German locale", () => expect(formatNumber(1234.5, "de-DE")).toBe("1.234,5"));
  it("formats with the English locale", () => expect(formatNumber(1234.5, "en-US")).toBe("1,234.5"));
  it("applies options", () =>
    expect(formatNumber(1.5, "en-US", { minimumFractionDigits: 2 })).toBe("1.50"));
  it("formats zero and negatives", () => {
    expect(formatNumber(0, "en-US")).toBe("0");
    expect(formatNumber(-12, "en-US")).toBe("-12");
  });
});
