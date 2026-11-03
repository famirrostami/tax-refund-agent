import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../../packs";
import { createSearchRulesTool, searchRules } from "./searchRules";

const pack = await loadPack(resolve(__dirname, "../../../../../../packs"), "de");

describe("searchRules", () => {
  it("finds the home-office rule", () => {
    const ids = searchRules(pack, { query: "working from home days", year: 2025 }).map((r) => r.id);
    expect(ids[0]).toBe("de.home_office.tagespauschale");
  });
  it("returns the right commute rule per year", () => {
    expect(searchRules(pack, { query: "commute distance km", year: 2025 })[0]?.id).toBe("de.commute.entfernungspauschale.2025");
    expect(searchRules(pack, { query: "commute distance km", year: 2026 })[0]?.id).toBe("de.commute.entfernungspauschale.2026");
  });
  it("never returns a rule that is not valid for the year", () => {
    const ids = searchRules(pack, { query: "union fees membership", year: 2025 }).map((r) => r.id);
    expect(ids).not.toContain("de.other.gewerkschaftsbeitraege.2026");
  });
  it("finds laptop rules in work_equipment and returns nothing for unrelated queries", () => {
    expect(searchRules(pack, { query: "laptop", year: 2025 }).map((r) => r.category)).toContain("work_equipment");
    expect(searchRules(pack, { query: "zebra", year: 2025 })).toEqual([]);
  });
  it("the tool exposes sources and open questions to the model", async () => {
    const t = createSearchRulesTool({ pack, year: 2025 });
    const out = (await t.execute!({ query: "laptop" }, { toolCallId: "1", messages: [] } as never)) as any;
    expect(out.results[0].sources[0].url).toMatch(/^https:\/\//);
    expect(out.results.some((r: any) => r.openQuestions.length > 0)).toBe(true);
  });
});
