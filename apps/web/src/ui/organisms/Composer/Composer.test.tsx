import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Composer, ComposerProps } from "./Composer";

function setup(over: Partial<ComposerProps> = {}) {
  const onSend = vi.fn();
  const onChange = vi.fn();
  const props: ComposerProps = {
    value: "hello",
    onChange,
    onSend,
    placeholder: "ph",
    sendLabel: "Send",
    inputLabel: "Message",
    ...over,
  };
  render(<Composer {...props} />);
  return { onSend, onChange, box: screen.getByRole("textbox", { name: "Message" }) };
}

describe("Composer", () => {
  it("sends on button click", async () => {
    const { onSend } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });
  it.each(["Control", "Meta"])("sends on %s+Enter", async (key) => {
    const { onSend, box } = setup();
    box.focus();
    await userEvent.keyboard(`{${key}>}{Enter}{/${key}}`);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
  it("does not send on plain Enter", async () => {
    const { onSend, box } = setup();
    box.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });
  it.each([
    ["empty", { value: "" }],
    ["whitespace", { value: "  \n " }],
    ["disabled", { disabled: true }],
    ["canSend=false", { canSend: false }],
  ])("does not send when %s", async (_n, over) => {
    const { onSend, box } = setup(over as Partial<ComposerProps>);
    box.focus();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
  it("sendDisabled blocks sending but keeps the input editable and focused", async () => {
    const { onSend, onChange, box } = setup({ sendDisabled: true });
    expect(box).toBeEnabled();
    box.focus();
    await userEvent.keyboard("x{Control>}{Enter}{/Control}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(box).toHaveFocus();
  });
  it("sendDisabled wins over canSend=true", () => {
    setup({ sendDisabled: true, canSend: true });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
  it("inputRef receives the textarea", () => {
    const inputRef = createRef<HTMLTextAreaElement>();
    const { box } = setup({ inputRef });
    expect(inputRef.current).toBe(box);
  });
  it("canSend=true overrides empty value", async () => {
    const { onSend } = setup({ value: "", canSend: true });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });
  it("calls onChange when typing", async () => {
    const { onChange, box } = setup({ value: "" });
    await userEvent.type(box, "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
  it("renders attachments and footer slots", () => {
    setup({ attachments: <span>att</span>, footer: <span>foot</span> });
    expect(screen.getByText("att")).toBeInTheDocument();
    expect(screen.getByText("foot")).toBeInTheDocument();
  });
});
