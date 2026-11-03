import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChoiceGroup, ChoiceOption } from "./ChoiceGroup";

const options: ChoiceOption[] = [
  { value: "a", label: "Alpha", description: "first" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("ChoiceGroup", () => {
  it("is a named radio group with checked state", () => {
    render(<ChoiceGroup name="g" legend="Pick" options={options} value="b" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Pick" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Beta" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Alpha" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAccessibleDescription("first");
  });
  it("calls onChange on click", async () => {
    const onChange = vi.fn();
    render(<ChoiceGroup name="g" legend="Pick" options={options} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Gamma" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });
  it("selects with ArrowDown from the keyboard", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [v, setV] = useState<string | null>("a");
      return <ChoiceGroup name="g" legend="Pick" options={options} value={v} onChange={(x) => { onChange(x); setV(x); }} />;
    }
    render(<Harness />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("radio", { name: "Beta" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveFocus();
  });
  it("disables all radios", () => {
    render(<ChoiceGroup name="g" legend="Pick" options={options} value={null} onChange={() => {}} disabled />);
    screen.getAllByRole("radio").forEach((r) => expect(r).toBeDisabled());
  });
});
