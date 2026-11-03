import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextInput } from "../../atoms";
import { FormField } from "./FormField";

const field = (props: { hint?: string; error?: string } = {}) => (
  <FormField label="Name" {...props}>
    {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} />}
  </FormField>
);

describe("FormField", () => {
  it("labels the control", () => {
    render(field());
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });
  it("links hint through aria-describedby", () => {
    render(field({ hint: "your full name" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("your full name");
  });
  it("announces error with role alert and links it", () => {
    render(field({ hint: "hint", error: "required" }));
    expect(screen.getByRole("alert")).toHaveTextContent("required");
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("hint required");
  });
  it("uses unique ids per instance", () => {
    render(<>{field()}{field()}</>);
    const [a, b] = screen.getAllByLabelText("Name");
    expect(a.id).not.toBe(b.id);
  });
});
