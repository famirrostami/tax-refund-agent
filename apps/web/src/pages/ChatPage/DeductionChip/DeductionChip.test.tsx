import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";

import type { DeductionCheck } from "../../../domain";
import { DeductionChip } from "./DeductionChip";

const base: DeductionCheck = {
  verdict: "deductible", amount: 120.5, currency: "EUR", ruleId: "r", taxYear: 2025, confidence: "medium",
  missingInfo: [], explanation: "Because it is.", breakdown: {}, caveats: ["Caveat one", "Caveat two"],
  sources: [{ label: "Source A", url: "https://example.org/a" }],
};

describe("DeductionChip", () => {
  it("deductible shows verdict, amount, confidence, caveats and sources", () => {
    renderWithProviders(<DeductionChip deduction={base} />);
    expect(screen.getByText("Deductible")).toBeInTheDocument();
    expect(screen.getByText(/120\.50/)).toBeInTheDocument();
    expect(screen.getByText("Confidence: medium")).toBeInTheDocument();
    expect(screen.getByText("Caveat one")).toBeInTheDocument();
    expect(screen.getByText("Caveat two")).toBeInTheDocument();
    expect(screen.getByText("Because it is.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source A" })).toHaveAttribute("href", "https://example.org/a");
    expect(document.querySelector('[data-verdict="deductible"]')).not.toBeNull();
  });
  it("needs_review shows no amount and is not styled as pass/fail", () => {
    const { container } = renderWithProviders(
      <DeductionChip deduction={{ ...base, verdict: "needs_review", amount: 99, missingInfo: [{ field: "x", description: "Need X" }] }} />,
    );
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByText(/99/)).toBeNull();
    expect(screen.queryByText("Deductible")).toBeNull();
    expect(screen.queryByText("Not deductible")).toBeNull();
    expect(screen.getByText("Need X")).toBeInTheDocument();
    expect(screen.getByText("Confidence: medium")).toBeInTheDocument();
    expect(container.querySelector('[data-verdict="needs_review"]')).not.toBeNull();
    expect(container.querySelector(".card--warning")).not.toBeNull();
  });
  it("handles null amount and not_deductible", () => {
    renderWithProviders(<DeductionChip deduction={{ ...base, verdict: "not_deductible", amount: null }} />);
    expect(screen.getByText("Not deductible")).toBeInTheDocument();
    expect(screen.queryByText(/Amount/)).toBeNull();
  });
});
