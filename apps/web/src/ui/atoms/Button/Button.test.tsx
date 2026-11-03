import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders a button with accessible name and default type", () => {
    render(<Button>go</Button>);
    expect(screen.getByRole("button", { name: "go" })).toHaveAttribute("type", "button");
  });
  it("forwards ref, className and native props", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref} className="x" data-testid="b" type="submit">go</Button>);
    expect(ref.current).toBe(screen.getByTestId("b"));
    expect(ref.current).toHaveClass("x");
    expect(ref.current).toHaveAttribute("type", "submit");
  });
  it("applies tone and size classes", () => {
    const { rerender } = render(<Button>go</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn", "btn--neutral", "btn--md");
    rerender(<Button tone="danger" size="sm">go</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn--danger", "btn--sm");
    rerender(<Button tone="primary">go</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn--primary");
  });
  it("calls onClick, and not when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} disabled>go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("is operable with Enter and Space", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>go</Button>);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
