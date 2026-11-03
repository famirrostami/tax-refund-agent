import { describe, expect, it } from "vitest";
import { formatFileMention } from "./formatFileMention";

describe("formatFileMention", () => {
  it("returns text unchanged without ids", () => expect(formatFileMention("hi", [])).toBe("hi"));
  it("returns only the id lines when the text is blank", () => {
    expect(formatFileMention("  ", ["f1", "f2"])).toBe("fileId: f1\nfileId: f2");
  });
  it("appends all ids", () => {
    const out = formatFileMention("hi", ["f1", "f2"]);
    expect(out.startsWith("hi")).toBe(true);
    expect(out).toContain("f1");
    expect(out).toContain("f2");
  });
});
