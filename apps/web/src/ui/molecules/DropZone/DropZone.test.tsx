import { render, screen, fireEvent, createEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DropZone } from "./DropZone";

const file = new File(["x"], "r.png", { type: "image/png" });
const setup = (props: Partial<React.ComponentProps<typeof DropZone>> = {}) => {
  const onFiles = vi.fn();
  render(<DropZone onFiles={onFiles} label="Choose files" busyLabel="uploading" data-testid="z" {...props} />);
  return { onFiles, zone: screen.getByTestId("z") };
};

describe("DropZone", () => {
  it("calls onFiles with dropped files", () => {
    const { onFiles, zone } = setup();
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
  it("calls onFiles with a file chosen via the input", async () => {
    const { onFiles } = setup({ accept: "image/*", multiple: true });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/*");
    await userEvent.upload(input, file);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
  it("picker button is keyboard focusable and opens the input", async () => {
    setup();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Choose files" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("sets data-dragging on dragenter/dragover and clears on leave and drop", () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute("data-dragging", "true");
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveAttribute("data-dragging");
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-dragging", "true");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(zone).not.toHaveAttribute("data-dragging");
  });
  it.each([["disabled"], ["busy"]] as const)("ignores drops and input when %s", async (flag) => {
    const { onFiles, zone } = setup({ [flag]: true });
    fireEvent.dragEnter(zone);
    expect(zone).not.toHaveAttribute("data-dragging");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(onFiles).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeDisabled();
  });
  it("shows a labelled spinner while busy and renders children", () => {
    setup({ busy: true, children: <p>hint</p> });
    expect(screen.getByRole("status", { name: "uploading" })).toBeInTheDocument();
    expect(screen.getByText("hint")).toBeInTheDocument();
  });
  it("prevents default on drag/drop events when active", () => {
    const { zone } = setup();
    for (const name of ["dragEnter", "dragOver", "drop"] as const) {
      const ev = createEvent[name](zone, { dataTransfer: { files: [file] } });
      fireEvent(zone, ev);
      expect(ev.defaultPrevented).toBe(true);
    }
  });
  it.each([["disabled"], ["busy"]] as const)("prevents default but ignores files and dragging when %s", (flag) => {
    const { onFiles, zone } = setup({ [flag]: true });
    for (const name of ["dragEnter", "dragOver", "drop"] as const) {
      const ev = createEvent[name](zone, { dataTransfer: { files: [file] } });
      fireEvent(zone, ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(zone).not.toHaveAttribute("data-dragging");
    }
    expect(onFiles).not.toHaveBeenCalled();
  });
});
