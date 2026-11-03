import { describe, expect, it } from "vitest";
import { exportUrl } from "./exports";

describe("exportUrl", () => {
  it("builds the download url with the year", () => {
    expect(exportUrl("exp_1", "summary.md", 2025)).toBe("/api/exports/exp_1/summary.md?year=2025");
    expect(exportUrl("exp_1", "entries.csv", 2024)).toBe("/api/exports/exp_1/entries.csv?year=2024");
    expect(exportUrl("exp_1", "export.json", 2025)).toBe("/api/exports/exp_1/export.json?year=2025");
  });
  it("encodes the export id", () => {
    expect(exportUrl("a/b c?", "summary.md", 2025)).toBe("/api/exports/a%2Fb%20c%3F/summary.md?year=2025");
  });
});
