import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders header, main and footer landmarks", () => {
    render(<AppShell header={<span>h</span>} footer={<span>f</span>}><span>m</span></AppShell>);
    expect(screen.getByRole("banner")).toHaveTextContent("h");
    expect(screen.getByRole("main")).toHaveTextContent("m");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("f");
  });
  it("omitted slots leave no wrapper", () => {
    render(<AppShell><span>m</span></AppShell>);
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
