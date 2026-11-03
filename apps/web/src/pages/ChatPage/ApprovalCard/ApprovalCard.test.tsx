import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Approval } from "../../../domain";
import { renderWithProviders } from "../../../test/render";
import { ApprovalCard } from "./ApprovalCard";

const approval: Approval = { approvalId: "a1", toolCallId: "t1", toolName: "export", ruleIds: ["r1"] };

function setup(disabled?: boolean) {
  const onApprove = vi.fn();
  const onDeny = vi.fn();
  renderWithProviders(<ApprovalCard approval={approval} onApprove={onApprove} onDeny={onDeny} disabled={disabled} />);
  return { onApprove, onDeny, user: userEvent.setup() };
}

describe("ApprovalCard", () => {
  it("shows translated copy and two buttons", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Approval needed" })).toBeInTheDocument();
    expect(screen.getByText(/writes files on this machine/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is sent to a tax authority/)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("calls handlers only on click and focuses neither on mount", async () => {
    const { onApprove, onDeny, user } = setup();
    expect(screen.getByRole("button", { name: "Approve" })).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Deny" })).not.toHaveFocus();
    expect(onApprove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDeny).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(onDeny).toHaveBeenCalledTimes(1);
  });

  it("disabled blocks both", async () => {
    const { onApprove, onDeny, user } = setup(true);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Deny" }));
    expect(onApprove).not.toHaveBeenCalled();
    expect(onDeny).not.toHaveBeenCalled();
  });
});
