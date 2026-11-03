import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("renders a combobox named by aria-label with caller options", () => {
    render(<Select aria-label="pick"><option value="a">A</option><option value="b">B</option></Select>);
    expect(screen.getByRole("combobox", { name: "pick" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
  it("forwards ref, className and native props; fires onChange", async () => {
    const ref = createRef<HTMLSelectElement>();
    const onChange = vi.fn();
    render(<Select ref={ref} aria-label="pick" className="x" onChange={onChange}><option value="a">A</option><option value="b">B</option></Select>);
    expect(ref.current).toBe(screen.getByRole("combobox"));
    expect(ref.current).toHaveClass("x", "select");
    await userEvent.selectOptions(screen.getByRole("combobox"), "b");
    expect(onChange).toHaveBeenCalled();
    expect(ref.current).toHaveValue("b");
  });
  it("can be disabled", () => {
    render(<Select aria-label="pick" disabled><option>A</option></Select>);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
