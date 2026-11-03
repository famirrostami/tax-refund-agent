import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";

import type { FormEntry, MappingResult } from "../../../domain";
import { EntriesView } from "./EntriesView";

const entry: FormEntry = {
  form: "Anlage N", section: "s", fieldId: "f1", line: "42", lineVerified: true,
  labelDe: "Werbungskosten", labelEn: "Work expenses", unit: "EUR", value: 1234.5, ruleIds: ["r1"],
};
const base: MappingResult = {
  taxYear: 2025, formStatus: "published", source: { label: "Official form", url: "https://example.org/f" },
  entries: [entry], informational: [], notMapped: [], missingInfo: [], warnings: [],
};

describe("EntriesView", () => {
  it("shows form, line, German label, English secondary and currency value", () => {
    renderWithProviders(<EntriesView mapping={base} />);
    expect(screen.getByRole("table", { name: "Form entries" })).toBeInTheDocument();
    expect(screen.getByText("Anlage N")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Werbungskosten")).toBeInTheDocument();
    expect(screen.getByText("Work expenses")).toBeInTheDocument();
    expect(screen.getByText(/1,234\.50/)).toBeInTheDocument();
    expect(screen.queryByText("Line numbers are not published yet for this form.")).toBeNull();
  });
  it("renders section headings only for non-empty lists", () => {
    const { unmount } = renderWithProviders(<EntriesView mapping={base} />);
    for (const name of ["Not mapped", "Missing information", "Notes"]) expect(screen.queryByRole("heading", { name })).toBeNull();
    unmount();
    renderWithProviders(
      <EntriesView
        mapping={{
          ...base,
          notMapped: [{ ruleId: "r9", reason: "no line" }],
          missingInfo: [{ ruleId: "r1", field: "days", description: "How many days?" }],
          informational: [{ ruleId: "r2", note: "Info note" }],
        }}
      />,
    );
    for (const name of ["Not mapped", "Missing information", "Notes"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  });
  it("the table is a focusable scroll region with a label", () => {
    renderWithProviders(<EntriesView mapping={base} />);
    expect(screen.getByRole("group", { name: "Form entries, scrollable" })).toHaveAttribute("tabindex", "0");
  });
  it("formats days, km and text units", () => {
    const entries: FormEntry[] = [
      { ...entry, fieldId: "a", unit: "days", value: 200 },
      { ...entry, fieldId: "b", unit: "km", value: 15 },
      { ...entry, fieldId: "c", unit: "text", value: 7 },
    ];
    renderWithProviders(<EntriesView mapping={{ ...base, entries }} />);
    expect(screen.getByText("200 days")).toBeInTheDocument();
    expect(screen.getByText("15 km")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
  it("null line renders an em dash and all warnings; pending shows the note", () => {
    renderWithProviders(
      <EntriesView mapping={{ ...base, formStatus: "pending", entries: [{ ...entry, line: null }], warnings: ["Warn A", "Warn B"] }} />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Warn A")).toBeInTheDocument();
    expect(screen.getByText("Warn B")).toBeInTheDocument();
    expect(screen.getByText("Line numbers are not published yet for this form.")).toBeInTheDocument();
  });
  it("lists notMapped, missingInfo, informational and the source link", () => {
    renderWithProviders(
      <EntriesView
        mapping={{
          ...base,
          informational: [{ ruleId: "i1", note: "Info note" }],
          notMapped: [{ ruleId: "n1", reason: "No field" }],
          missingInfo: [{ ruleId: "m1", field: "km", description: "Need distance" }],
        }}
      />,
    );
    expect(screen.getByText(/Info note/)).toBeInTheDocument();
    expect(screen.getByText(/No field/)).toBeInTheDocument();
    expect(screen.getByText(/Need distance/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Official form" });
    expect(link).toHaveAttribute("href", "https://example.org/f");
    expect(link).toHaveAttribute("target", "_blank");
  });
  it("shows the empty label with no entries", () => {
    renderWithProviders(<EntriesView mapping={{ ...base, entries: [] }} />);
    expect(screen.getByText("No entries.")).toBeInTheDocument();
  });
  it("shows all warnings for a published form with non-null lines", () => {
    renderWithProviders(<EntriesView mapping={{ ...base, warnings: ["Line not confirmed", "Cap warning"] }} />);
    expect(screen.getByText("Line not confirmed")).toBeInTheDocument();
    expect(screen.getByText("Cap warning")).toBeInTheDocument();
  });
  it("shows warnings for a pending form with empty entries", () => {
    renderWithProviders(<EntriesView mapping={{ ...base, formStatus: "pending", entries: [], warnings: ["Pending warn"] }} />);
    expect(screen.getByText("Pending warn")).toBeInTheDocument();
    expect(screen.getByText("Line numbers are not published yet for this form.")).toBeInTheDocument();
  });
  it("renders no warnings notice when warnings are empty", () => {
    renderWithProviders(<EntriesView mapping={base} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
