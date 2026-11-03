import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisuallyHidden } from "./VisuallyHidden";

describe("VisuallyHidden", () => {
  it("keeps its text in the accessibility tree", () => {
    render(<button><VisuallyHidden>close</VisuallyHidden></button>);
    expect(screen.getByRole("button", { name: "close" })).toBeInTheDocument();
    expect(screen.getByText("close")).toHaveClass("visually-hidden");
  });
  it("forwards ref, className and native props", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<VisuallyHidden ref={ref} className="x" data-testid="v">t</VisuallyHidden>);
    expect(ref.current).toBe(screen.getByTestId("v"));
    expect(ref.current).toHaveClass("x");
  });
});
