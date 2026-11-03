import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import type { Question } from "../../../domain";
import { renderWithProviders } from "../../../test/render";
import { QuestionCard } from "./QuestionCard";

let n = 0;
const q = (over: Partial<Question>): Question => ({ toolCallId: `tc-${++n}`, question: "Q?", answerType: "text", ...over });

function setup(question: Question, extra: { disabled?: boolean } = {}) {
  const onAnswer = vi.fn();
  const store = createStore();
  const ui = (qq: Question) => <QuestionCard question={qq} onAnswer={onAnswer} {...extra} />;
  const r = renderWithProviders(ui(question), { store });
  return { onAnswer, user: userEvent.setup(), rerender: () => r.rerender(ui(question)) };
}

describe("QuestionCard", () => {
  it("renders heading and text control", () => {
    setup(q({ question: "What is your name?" }));
    expect(screen.getByRole("heading", { name: "What is your name?" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeInTheDocument();
  });

  it("text submits trimmed value", async () => {
    const { onAnswer, user } = setup(q({}));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "  hello ");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onAnswer).toHaveBeenCalledWith({ answered: true, value: "hello" });
  });

  it("number uses decimal input mode and returns number", async () => {
    const { onAnswer, user } = setup(q({ answerType: "number" }));
    const input = screen.getByRole("textbox", { name: "Your answer" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await user.type(input, "120");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onAnswer).toHaveBeenCalledWith({ answered: true, value: 120 });
  });

  it("number accepts decimal comma", async () => {
    const { onAnswer, user } = setup(q({ answerType: "number" }));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "120,5");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onAnswer).toHaveBeenCalledWith({ answered: true, value: 120.5 });
  });

  it("invalid number shows translated error and does not answer", async () => {
    const { onAnswer, user } = setup(q({ answerType: "number" }));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "abc");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a valid number.");
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("a thousands-separated number shows the ambiguity error and does not answer", async () => {
    const { onAnswer, user } = setup(q({ answerType: "number" }));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "1.000");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByText("Please write the number without thousands separators, e.g. 1000.")).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("empty answer shows required error", async () => {
    const { onAnswer, user } = setup(q({}));
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter an answer.");
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("min violation interpolates number", async () => {
    const { onAnswer, user } = setup(q({ answerType: "number", min: 10, max: 20 }));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "5");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The value must be at least 10.");
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("max violation interpolates number", async () => {
    const { onAnswer, user } = setup(q({ answerType: "number", min: 10, max: 20 }));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "25");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The value must be at most 20.");
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows unit and range hint", () => {
    setup(q({ answerType: "number", unit: "EUR", min: 0, max: 100 }));
    expect(screen.getByText("Unit: EUR")).toBeInTheDocument();
    expect(screen.getByText("Between 0 and 100")).toBeInTheDocument();
  });

  it("boolean returns true and false", async () => {
    const a = setup(q({ answerType: "boolean" }));
    expect(screen.getByRole("group", { name: "Your answer" })).toBeInTheDocument();
    await a.user.click(screen.getByRole("radio", { name: "Yes" }));
    await a.user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(a.onAnswer).toHaveBeenCalledWith({ answered: true, value: true });
  });

  it("boolean no returns false", async () => {
    const a = setup(q({ answerType: "boolean" }));
    await a.user.click(screen.getByRole("radio", { name: "No" }));
    await a.user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(a.onAnswer).toHaveBeenCalledWith({ answered: true, value: false });
  });

  it("boolean without selection errors", async () => {
    const a = setup(q({ answerType: "boolean" }));
    await a.user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter an answer.");
    expect(a.onAnswer).not.toHaveBeenCalled();
  });

  it("choice shows labels, returns value", async () => {
    const a = setup(q({ answerType: "choice", choices: [{ value: "a1", label: "Alpha" }, { value: "b2", label: "Beta" }] }));
    await a.user.click(screen.getByRole("radio", { name: "Beta" }));
    await a.user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(a.onAnswer).toHaveBeenCalledWith({ answered: true, value: "b2" });
  });

  it("date returns the string", async () => {
    const a = setup(q({ answerType: "date" }));
    const input = screen.getByLabelText("Your answer");
    expect(input).toHaveAttribute("type", "date");
    await a.user.type(input, "2025-03-14");
    await a.user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(a.onAnswer).toHaveBeenCalledWith({ answered: true, value: "2025-03-14" });
  });

  it("skip and dont-know payloads", async () => {
    const a = setup(q({}));
    await a.user.click(screen.getByRole("button", { name: "Skip" }));
    expect(a.onAnswer).toHaveBeenLastCalledWith({ answered: false, reason: "skipped" });
    await a.user.click(screen.getByRole("button", { name: "I don't know" }));
    expect(a.onAnswer).toHaveBeenLastCalledWith({ answered: false, reason: "dont_know" });
  });

  it("disabled blocks everything", async () => {
    const a = setup(q({}), { disabled: true });
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeDisabled();
    for (const name of ["Submit answer", "Skip", "I don't know"]) {
      await a.user.click(screen.getByRole("button", { name }));
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(a.onAnswer).not.toHaveBeenCalled();
  });

  it("typed draft survives a rerender", async () => {
    const a = setup(q({}));
    await a.user.type(screen.getByRole("textbox", { name: "Your answer" }), "keep me");
    a.rerender();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("keep me");
  });
});
