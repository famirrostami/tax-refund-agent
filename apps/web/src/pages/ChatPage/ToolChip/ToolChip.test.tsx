import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";

import { ToolChip } from "./ToolChip";

describe("ToolChip", () => {
  it("maps known tool names and shows a spinner while in progress", () => {
    renderWithProviders(<ToolChip part={{ kind: "toolStatus", toolName: "searchRules", state: "input-available" }} />);
    expect(screen.getByText("Searching rules")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "In progress" })).toBeInTheDocument();
  });
  it("falls back to raw tool name and raw state", () => {
    renderWithProviders(<ToolChip part={{ kind: "toolStatus", toolName: "weirdTool", state: "mystery" }} />);
    expect(screen.getByText("weirdTool")).toBeInTheDocument();
    expect(screen.getByText("mystery")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("shows denied state without spinner", () => {
    renderWithProviders(<ToolChip part={{ kind: "toolStatus", toolName: "buildExport", state: "output-denied" }} />);
    expect(screen.getByText("Building export")).toBeInTheDocument();
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
