import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Notice } from "./Notice";

describe("Notice", () => {
  it("danger uses role alert", () => {
    render(<Notice tone="danger">bad</Notice>);
    expect(screen.getByRole("alert")).toHaveTextContent("bad");
  });
  it.each(["info", "warning", "success"] as const)("%s uses role status", (tone) => {
    render(<Notice tone={tone}>ok</Notice>);
    expect(screen.getByRole("status")).toHaveClass(`notice--${tone}`);
  });
  it("renders title and actions slots", () => {
    render(<Notice tone="info" title="T" actions={<button>act</button>}>body</Notice>);
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "act" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("body");
  });
});
