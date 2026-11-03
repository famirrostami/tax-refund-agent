import { describe, expect, it } from "vitest";
import { validateAnswer } from "./validateAnswer";

describe("validateAnswer", () => {
  it("accepts text and trims it", () =>
    expect(validateAnswer({ answerType: "text" }, "  hi ")).toEqual({ ok: true, value: "hi" }));
  it("requires text", () => {
    expect(validateAnswer({ answerType: "text" }, "")).toEqual({ ok: false, reason: "required" });
    expect(validateAnswer({ answerType: "text" }, "   ")).toEqual({ ok: false, reason: "required" });
  });
  it("accepts numbers with dot or comma", () => {
    expect(validateAnswer({ answerType: "number" }, "120")).toEqual({ ok: true, value: 120 });
    expect(validateAnswer({ answerType: "number" }, "120,5")).toEqual({ ok: true, value: 120.5 });
  });
  it.each(["1,000", "1.000", "1.000.000", "1,000,000", "12,345", "-1,000", "1.000,50", "1,000.50"])(
    "rejects %s as an ambiguous number (thousands separators)",
    (raw) => expect(validateAnswer({ answerType: "number" }, raw)).toEqual({ ok: false, reason: "ambiguous_number" }),
  );
  it.each([
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["120", 120],
    ["120,5", 120.5],
    ["0,001", 0.001],
    ["0.500", 0.5],
    ["1000", 1000],
    ["1,0005", 1.0005],
  ])("accepts %s as %d", (raw, value) => expect(validateAnswer({ answerType: "number" }, raw)).toEqual({ ok: true, value }));
  it("rejects non-numbers", () => {
    expect(validateAnswer({ answerType: "number" }, "abc")).toEqual({ ok: false, reason: "not_a_number" });
    expect(validateAnswer({ answerType: "number" }, "12abc")).toEqual({ ok: false, reason: "not_a_number" });
    expect(validateAnswer({ answerType: "number" }, "")).toEqual({ ok: false, reason: "required" });
  });
  it("enforces min and max", () => {
    const spec = { answerType: "number" as const, min: 0, max: 10 };
    expect(validateAnswer(spec, "-1")).toEqual({ ok: false, reason: "too_small" });
    expect(validateAnswer(spec, "11")).toEqual({ ok: false, reason: "too_large" });
    expect(validateAnswer(spec, "0")).toEqual({ ok: true, value: 0 });
    expect(validateAnswer(spec, "10")).toEqual({ ok: true, value: 10 });
  });
  it("passes booleans through", () => {
    expect(validateAnswer({ answerType: "boolean" }, true)).toEqual({ ok: true, value: true });
    expect(validateAnswer({ answerType: "boolean" }, false)).toEqual({ ok: true, value: false });
  });
  it("validates choices", () => {
    const spec = { answerType: "choice" as const, choices: [{ value: "a", label: "A" }] };
    expect(validateAnswer(spec, "a")).toEqual({ ok: true, value: "a" });
    expect(validateAnswer(spec, "z")).toEqual({ ok: false, reason: "not_a_choice" });
    expect(validateAnswer(spec, "")).toEqual({ ok: false, reason: "required" });
    expect(validateAnswer({ answerType: "choice" }, "a")).toEqual({ ok: false, reason: "not_a_choice" });
  });
  it("requires YYYY-MM-DD dates", () => {
    expect(validateAnswer({ answerType: "date" }, "2025-03-09")).toEqual({ ok: true, value: "2025-03-09" });
    expect(validateAnswer({ answerType: "date" }, "09.03.2025")).toEqual({ ok: false, reason: "not_a_date" });
    expect(validateAnswer({ answerType: "date" }, "2025-02-30")).toEqual({ ok: false, reason: "not_a_date" });
    expect(validateAnswer({ answerType: "date" }, "")).toEqual({ ok: false, reason: "required" });
  });
  it("treats a boolean given to a non-boolean type as required-failure", () =>
    expect(validateAnswer({ answerType: "text" }, true)).toEqual({ ok: false, reason: "required" }));
});
