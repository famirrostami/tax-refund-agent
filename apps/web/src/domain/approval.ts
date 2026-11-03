export type Approval = {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  /** Rule ids the pending action covers (informational, from the tool input). */
  ruleIds: string[];
  /** The user's decision; absent while the approval is still pending. */
  approved?: boolean;
};
