import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatLog } from "./ChatLog";

function stub(el: HTMLElement) {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: 500 });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 100 });
  Object.defineProperty(el, "scrollTop", { configurable: true, writable: true, value: 0 });
}

describe("ChatLog", () => {
  it("is a polite live log", () => {
    render(<ChatLog aria-label="Chat">x</ChatLog>);
    const log = screen.getByRole("log", { name: "Chat" });
    expect(log).toHaveAttribute("aria-live", "polite");
  });
  it("shows emptyContent without children", () => {
    render(<ChatLog aria-label="c" emptyContent={<p>nothing</p>} />);
    expect(screen.getByText("nothing")).toBeInTheDocument();
  });
  it("hides emptyContent with children", () => {
    render(<ChatLog aria-label="c" emptyContent={<p>nothing</p>}><p>msg</p></ChatLog>);
    expect(screen.queryByText("nothing")).toBeNull();
  });
  it("scrolls to bottom when children change", () => {
    const { rerender } = render(<ChatLog aria-label="c"><p>a</p></ChatLog>);
    const log = screen.getByRole("log");
    stub(log);
    rerender(<ChatLog aria-label="c"><p>a</p><p>b</p></ChatLog>);
    expect(log.scrollTop).toBe(500);
  });
  it("does not scroll when the user scrolled up", () => {
    const { rerender } = render(<ChatLog aria-label="c"><p>a</p></ChatLog>);
    const log = screen.getByRole("log");
    stub(log);
    fireEvent.scroll(log);
    rerender(<ChatLog aria-label="c"><p>a</p><p>b</p></ChatLog>);
    expect(log.scrollTop).toBe(0);
  });
  it.each([
    ["false", false],
    ["null", null],
    ["undefined", undefined],
    ["[null, false]", [null, false]],
  ])("shows emptyContent when children is %s", (_n, kids) => {
    render(<ChatLog aria-label="c" emptyContent={<p>nothing</p>}>{kids}</ChatLog>);
    expect(screen.getByText("nothing")).toBeInTheDocument();
  });
  it("hides emptyContent when a real child sits beside a false", () => {
    render(<ChatLog aria-label="c" emptyContent={<p>nothing</p>}>{false}<p>msg</p></ChatLog>);
    expect(screen.queryByText("nothing")).toBeNull();
    expect(screen.getByText("msg")).toBeInTheDocument();
  });
});
