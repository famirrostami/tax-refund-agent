import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("has role status named by aria-label and no text of its own", () => {
    render(<Spinner aria-label="busy" />);
    const el = screen.getByRole("status", { name: "busy" });
    expect(el).toHaveClass("spinner");
    expect(el).toBeEmptyDOMElement();
  });
  it("forwards ref, className and native props", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Spinner ref={ref} aria-label="busy" className="x" data-testid="s" />);
    expect(ref.current).toBe(screen.getByTestId("s"));
    expect(ref.current).toHaveClass("x");
  });
});
