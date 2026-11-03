import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { List } from "./List";

const items = [
  { key: "1", content: "one" },
  { key: "2", content: "two" },
];

describe("List", () => {
  it("renders an unordered list by default", () => {
    render(<List items={items} />);
    expect(screen.getByRole("list").tagName).toBe("UL");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
  it("renders an ordered list", () => {
    render(<List items={items} ordered />);
    expect(screen.getByRole("list").tagName).toBe("OL");
  });
  it("shows emptyLabel when no items", () => {
    render(<List items={[]} emptyLabel="empty!" />);
    expect(screen.getByText("empty!")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
  it("renders nothing when empty without label", () => {
    const { container } = render(<List items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
