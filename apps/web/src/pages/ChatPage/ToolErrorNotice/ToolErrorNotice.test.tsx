import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";

import { ToolErrorNotice } from "./ToolErrorNotice";

describe("ToolErrorNotice", () => {
  it("shows message and code in an alert", () => {
    renderWithProviders(<ToolErrorNotice part={{ kind: "toolError", toolCallId: "t", toolName: "buildExport", code: "E_FAIL", message: "Export failed on server" }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Export failed on server");
    expect(alert).toHaveTextContent("Code: E_FAIL");
  });
});
