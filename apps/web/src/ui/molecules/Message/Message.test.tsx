import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Message } from "./Message";

describe("Message", () => {
  it("renders header, children and footer inside a labelled article", () => {
    render(
      <Message role="assistant" aria-label="from helper" header={<span>head</span>} footer={<span>foot</span>}>
        body
      </Message>,
    );
    const el = screen.getByRole("article", { name: "from helper" });
    expect(el).toHaveTextContent("head");
    expect(el).toHaveTextContent("body");
    expect(el).toHaveTextContent("foot");
  });
  it("exposes role as presentational data and class, not an ARIA role", () => {
    render(<Message role="user" aria-label="x" className="extra">hi</Message>);
    const el = screen.getByRole("article");
    expect(el).toHaveAttribute("data-role", "user");
    expect(el).toHaveClass("message", "message--user", "extra");
    expect(el).not.toHaveAttribute("role");
  });
  it("supports aria-labelledby and forwards ref", () => {
    const ref = createRef<HTMLElement>();
    render(<><h2 id="h">title</h2><Message ref={ref} role="user" aria-labelledby="h">hi</Message></>);
    expect(screen.getByRole("article", { name: "title" })).toBe(ref.current);
  });
});
