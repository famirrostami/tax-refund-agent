import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children text in a span", () => {
    render(<Badge>new</Badge>);
    expect(screen.getByText("new").tagName).toBe("SPAN");
  });
  it("defaults to neutral and applies each tone", () => {
    const { rerender } = render(<Badge>t</Badge>);
    expect(screen.getByText("t")).toHaveClass("badge", "badge--neutral");
    for (const tone of ["info", "warning", "danger", "success"] as const) {
      rerender(<Badge tone={tone}>t</Badge>);
      expect(screen.getByText("t")).toHaveClass(`badge--${tone}`);
    }
  });
  it("forwards ref, className and native props", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref} className="x" data-testid="b">t</Badge>);
    expect(ref.current).toBe(screen.getByTestId("b"));
    expect(ref.current).toHaveClass("x");
  });
});
