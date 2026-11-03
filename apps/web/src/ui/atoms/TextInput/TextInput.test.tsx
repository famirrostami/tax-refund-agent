import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextInput } from "./TextInput";

describe("TextInput", () => {
  it("renders a single-line input named by aria-label", () => {
    render(<TextInput aria-label="name" />);
    expect(screen.getByRole("textbox", { name: "name" }).tagName).toBe("INPUT");
  });
  it("is named by aria-labelledby", () => {
    render(<><span id="l">lbl</span><TextInput aria-labelledby="l" /></>);
    expect(screen.getByRole("textbox", { name: "lbl" })).toBeInTheDocument();
  });
  it("multiline renders a textarea", () => {
    render(<TextInput multiline aria-label="msg" rows={3} />);
    const el = screen.getByRole("textbox", { name: "msg" });
    expect(el.tagName).toBe("TEXTAREA");
    expect(el).toHaveAttribute("rows", "3");
  });
  it("forwards ref (input and textarea), className and native props", () => {
    const a = createRef<HTMLInputElement>();
    const b = createRef<HTMLTextAreaElement>();
    render(<><TextInput ref={a} aria-label="a" className="x" placeholder="p" /><TextInput multiline ref={b} aria-label="b" /></>);
    expect(a.current).toBe(screen.getByRole("textbox", { name: "a" }));
    expect(a.current).toHaveClass("x", "input");
    expect(a.current).toHaveAttribute("placeholder", "p");
    expect(b.current).toBe(screen.getByRole("textbox", { name: "b" }));
  });
  it("invalid sets aria-invalid", () => {
    const { rerender } = render(<TextInput aria-label="a" />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
    rerender(<TextInput aria-label="a" invalid />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    rerender(<TextInput aria-label="a" multiline invalid />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
  it("supports typing, onChange and disabled", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TextInput aria-label="a" onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "hi");
    expect(screen.getByRole("textbox")).toHaveValue("hi");
    expect(onChange).toHaveBeenCalledTimes(2);
    rerender(<TextInput aria-label="a" multiline disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
