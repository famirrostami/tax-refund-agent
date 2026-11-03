import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table } from "./Table";

const columns = [
  { key: "a", header: "Col A" },
  { key: "b", header: "Col B", align: "end" as const },
];

describe("Table", () => {
  it("renders caption, headers and cells", () => {
    render(<Table caption="Cap" columns={columns} rows={[{ a: "one", b: <b>two</b> }]} emptyLabel="none" />);
    expect(screen.getByRole("table", { name: "Cap" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Col A" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("cell", { name: "one" })).toBeInTheDocument();
    expect(screen.getByText("two").tagName).toBe("B");
  });
  it("empty state replaces rows", () => {
    render(<Table caption="Cap" columns={columns} rows={[]} emptyLabel="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(1);
  });
  it("sets align on header and cells", () => {
    render(<Table caption="Cap" columns={columns} rows={[{ a: "x", b: "y" }]} emptyLabel="n" />);
    expect(screen.getByRole("columnheader", { name: "Col B" })).toHaveAttribute("data-align", "end");
    expect(screen.getByRole("cell", { name: "y" })).toHaveAttribute("data-align", "end");
    expect(screen.getByRole("cell", { name: "x" })).toHaveAttribute("data-align", "start");
  });
  it("uses rowKey and scroll label only when provided", () => {
    const { rerender, container } = render(
      <Table caption="C" columns={columns} rows={[{ a: "x", b: "y" }]} emptyLabel="n" rowKey={(r) => String(r.a)} />,
    );
    expect(screen.queryByLabelText("scroll")).toBeNull();
    expect(container.querySelector(".table-wrap")).not.toHaveAttribute("tabindex");
    rerender(<Table caption="C" columns={columns} rows={[{ a: "x", b: "y" }]} emptyLabel="n" scrollLabel="scroll" />);
    const wrap = screen.getByLabelText("scroll");
    expect(wrap).toHaveAttribute("tabindex", "0");
    expect(within(wrap).getByRole("table")).toBeInTheDocument();
  });
});
