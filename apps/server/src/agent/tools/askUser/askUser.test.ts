import { describe, expect, it } from "vitest";
import { answerSchema, createAskUserTool, findInvalidAnswer, questionSchema, validateAnswer, type Question } from "./askUser";

const num: Question = { question: "How many km?", answerType: "number", unit: "km", min: 0, max: 500 };
const choice: Question = { question: "Car?", answerType: "choice", choices: [{ value: "car", label: "Car" }, { value: "train", label: "Train" }] };

describe("question schema", () => {
  it("requires at least two choices for choice questions and none otherwise", () => {
    expect(questionSchema.safeParse({ question: "q", answerType: "choice", choices: [{ value: "a", label: "A" }] }).success).toBe(false);
    expect(questionSchema.safeParse({ question: "q", answerType: "number", choices: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }).success).toBe(false);
    expect(questionSchema.safeParse(choice).success).toBe(true);
  });
});

describe("validateAnswer", () => {
  it("checks numbers against type and bounds", () => {
    expect(validateAnswer(num, { answered: true, value: 30 })).toBeNull();
    expect(validateAnswer(num, { answered: true, value: 900 })).toMatch(/at most/);
    expect(validateAnswer(num, { answered: true, value: "30" })).toMatch(/number/);
  });
  it("checks choices, booleans, dates and text", () => {
    expect(validateAnswer(choice, { answered: true, value: "train" })).toBeNull();
    expect(validateAnswer(choice, { answered: true, value: "plane" })).toMatch(/choices/);
    expect(validateAnswer({ question: "q", answerType: "boolean" }, { answered: true, value: "yes" })).toMatch(/true or false/);
    expect(validateAnswer({ question: "q", answerType: "date" }, { answered: true, value: "2025-03-14" })).toBeNull();
    expect(validateAnswer({ question: "q", answerType: "date" }, { answered: true, value: "14.03.2025" })).toMatch(/YYYY-MM-DD/);
    expect(validateAnswer({ question: "q", answerType: "text" }, { answered: true, value: "  " })).toMatch(/non-empty/);
  });
  it("accepts skipped and unknown answers", () => {
    expect(validateAnswer(num, { answered: false, reason: "dont_know" })).toBeNull();
    expect(answerSchema.safeParse({ answered: false, reason: "whatever" }).success).toBe(false);
  });
});

describe("askUser tool", () => {
  it("is client-side: no execute function", () => {
    expect(createAskUserTool().execute).toBeUndefined();
  });
});

describe("findInvalidAnswer", () => {
  const msg = (input: unknown, output: unknown) => [{ parts: [{ type: "tool-askUser", state: "output-available", input, output }] }];
  it("passes valid history and ignores unanswered questions", () => {
    expect(findInvalidAnswer(msg(num, { answered: true, value: 12 }))).toBeNull();
    expect(findInvalidAnswer([{ parts: [{ type: "tool-askUser", state: "input-available", input: num }] }])).toBeNull();
    expect(findInvalidAnswer([{ parts: [{ type: "text" }] }])).toBeNull();
  });
  it("flags answers that do not fit the question or are malformed", () => {
    expect(findInvalidAnswer(msg(num, { answered: true, value: 9999 }))).toMatch(/at most/);
    expect(findInvalidAnswer(msg(num, { nonsense: 1 }))).toMatch(/malformed/);
  });
});
