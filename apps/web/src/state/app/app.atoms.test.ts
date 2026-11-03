import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { selectedYearAtom } from "./app.atoms";

describe("app atoms", () => {
  it("selectedYearAtom starts null and can be set", () => {
    const s = createStore();
    expect(s.get(selectedYearAtom)).toBeNull();
    s.set(selectedYearAtom, 2024);
    expect(s.get(selectedYearAtom)).toBe(2024);
  });
});
