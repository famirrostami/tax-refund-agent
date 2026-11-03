import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Link } from "./Link";

describe("Link", () => {
  it("renders an anchor with role link and name from children", () => {
    render(<Link href="/x">go</Link>);
    const el = screen.getByRole("link", { name: "go" });
    expect(el).toHaveAttribute("href", "/x");
    expect(el).not.toHaveAttribute("target");
  });
  it("external adds target and rel", () => {
    render(<Link href="https://e.com" external>go</Link>);
    const el = screen.getByRole("link");
    expect(el).toHaveAttribute("target", "_blank");
    expect(el).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("passes download through and forwards ref and className", () => {
    const ref = createRef<HTMLAnchorElement>();
    render(<Link ref={ref} href="/f" download="f.pdf" className="x">go</Link>);
    expect(ref.current).toHaveAttribute("download", "f.pdf");
    expect(ref.current).toHaveClass("x", "link");
  });
});
