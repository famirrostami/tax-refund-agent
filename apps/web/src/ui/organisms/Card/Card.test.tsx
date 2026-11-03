import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders header, body and actions slots in a labelled section", () => {
    render(
      <Card aria-label="lbl" header={<h2>H</h2>} actions={<button>go</button>}>
        body
      </Card>,
    );
    const region = screen.getByRole("region", { name: "lbl" });
    expect(region).toHaveTextContent("body");
    expect(screen.getByRole("heading", { name: "H" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "go" })).toBeInTheDocument();
  });
  it("omits header and actions wrappers when absent", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.querySelector(".card__header")).toBeNull();
    expect(container.querySelector(".card__actions")).toBeNull();
  });
  it("applies tone class", () => {
    const { container } = render(<Card tone="danger">x</Card>);
    expect(container.firstElementChild).toHaveClass("card--danger");
  });
});
