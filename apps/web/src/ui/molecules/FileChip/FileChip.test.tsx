import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileChip } from "./FileChip";

describe("FileChip", () => {
  it("shows the file name and status slot", () => {
    render(<FileChip name="a.pdf" removeLabel="remove a.pdf" status={<i>busy</i>} />);
    expect(screen.getByText("a.pdf")).toBeInTheDocument();
    expect(screen.getByText("busy")).toBeInTheDocument();
  });
  it("remove button has its label and fires onRemove", async () => {
    const onRemove = vi.fn();
    render(<FileChip name="a.pdf" removeLabel="remove a.pdf" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "remove a.pdf" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
  it("omits the remove button without onRemove; forwards ref and className", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<FileChip ref={ref} className="x" name="a" removeLabel="rm" data-testid="c" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(ref.current).toBe(screen.getByTestId("c"));
    expect(ref.current).toHaveClass("file-chip", "x");
  });
});
