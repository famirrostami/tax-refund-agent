import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";

import type { ChecklistResult } from "../../../domain";
import { ChecklistView } from "./ChecklistView";

const checklist: ChecklistResult = {
  taxYear: 2025,
  uploadSteps: [
    { text: "Step one", source: { label: "Portal", url: "https://example.org/p" } },
    { text: "Step two", source: { label: "Help", url: "https://example.org/h" } },
  ],
  perRule: [
    {
      ruleId: "r1", title: "Rule title",
      items: [
        { id: "a", kind: "document", text: "Official doc", official: true, status: "have" },
        { id: "b", kind: "document", text: "Nice to have doc", why: "Because reasons", official: false, status: "missing" },
      ],
    },
  ],
  skipped: [{ ruleId: "s1", reason: "Skipped reason" }],
  missingCount: 1,
  warnings: ["Checklist warning"],
};

describe("ChecklistView", () => {
  it("shows item text, status badges and the recommended badge only for unofficial items", () => {
    renderWithProviders(<ChecklistView checklist={checklist} />);
    expect(screen.getByRole("region", { name: "Rule title" })).toBeInTheDocument();
    const official = screen.getByText("Official doc").closest("li") as HTMLElement;
    const rec = screen.getByText("Nice to have doc").closest("li") as HTMLElement;
    expect(within(official).queryByText("Recommended")).toBeNull();
    expect(within(official).getByText("Official")).toBeInTheDocument();
    expect(within(official).getByText("Have")).toBeInTheDocument();
    expect(within(rec).getByText("Recommended")).toBeInTheDocument();
    expect(within(rec).getByText("Missing")).toBeInTheDocument();
    expect(within(rec).getByText(/not an official requirement/)).toBeInTheDocument();
    expect(within(rec).getByText(/Because reasons/)).toBeInTheDocument();
  });
  it("renders ordered upload steps with source links, skipped and warnings", () => {
    renderWithProviders(<ChecklistView checklist={checklist} />);
    const ol = screen.getAllByRole("list").find((l) => l.tagName === "OL") as HTMLElement;
    expect(within(ol).getAllByRole("listitem")).toHaveLength(2);
    expect(within(ol).getByRole("link", { name: "Portal" })).toHaveAttribute("href", "https://example.org/p");
    expect(screen.getByText(/Skipped reason/)).toBeInTheDocument();
    expect(screen.getByText("Checklist warning")).toBeInTheDocument();
  });
  it("shows the Skipped heading only when something was skipped", () => {
    const { unmount } = renderWithProviders(<ChecklistView checklist={checklist} />);
    expect(screen.getByRole("heading", { name: "Skipped" })).toBeInTheDocument();
    unmount();
    renderWithProviders(<ChecklistView checklist={{ ...checklist, skipped: [] }} />);
    expect(screen.queryByRole("heading", { name: "Skipped" })).toBeNull();
  });
  it("pluralises missingCount", () => {
    const { unmount } = renderWithProviders(<ChecklistView checklist={checklist} />);
    expect(screen.getByText("1 item missing")).toBeInTheDocument();
    unmount();
    renderWithProviders(<ChecklistView checklist={{ ...checklist, missingCount: 3 }} />);
    expect(screen.getByText("3 items missing")).toBeInTheDocument();
  });
});
