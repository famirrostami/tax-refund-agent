import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";

import type { ExportResult } from "../../../domain";
import { ExportDownloads } from "./ExportDownloads";

const result: ExportResult = {
  exportId: "exp_1", files: ["summary.md", "entries.csv", "export.json"],
  entryCount: 1, documentCount: 3, notMappedCount: 2, warnings: ["Export warning"],
};

describe("ExportDownloads", () => {
  it("renders three download links with correct hrefs", () => {
    renderWithProviders(<ExportDownloads result={result} year={2025} />);
    for (const name of result.files) {
      const link = document.querySelector(`a[href="/api/exports/exp_1/${name}?year=2025"]`);
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute("download", name);
    }
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Download summary (summary.md)" })).toBeInTheDocument();
  });
  it("shows plural summary and warnings", () => {
    renderWithProviders(<ExportDownloads result={result} year={2025} />);
    expect(screen.getByText(/1 entry/)).toBeInTheDocument();
    expect(screen.getByText(/3 documents/)).toBeInTheDocument();
    expect(screen.getByText(/2 items not mapped/)).toBeInTheDocument();
    expect(screen.getByText("Export warning")).toBeInTheDocument();
  });
  it("renders no links without files or exportId", () => {
    const { unmount } = renderWithProviders(<ExportDownloads result={{ ...result, files: [] }} year={2025} />);
    expect(screen.queryByRole("link")).toBeNull();
    unmount();
    renderWithProviders(<ExportDownloads result={{ ...result, exportId: "" }} year={2025} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
