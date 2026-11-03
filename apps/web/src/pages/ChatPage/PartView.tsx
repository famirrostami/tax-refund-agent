import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Answer, ChatPart } from "../../domain";
import { Badge } from "../../ui/atoms";
import { AnswerSummary } from "./AnswerSummary";
import { ApprovalCard } from "./ApprovalCard";
import { ChecklistView } from "./ChecklistView";
import { DeductionChip } from "./DeductionChip";
import { EntriesView } from "./EntriesView";
import { ExportDownloads } from "./ExportDownloads";
import { QuestionCard } from "./QuestionCard";
import { ToolChip } from "./ToolChip";
import { ToolErrorNotice } from "./ToolErrorNotice";

export interface PartViewProps {
  part: ChatPart;
  year: number;
  /** True only for the one human-gated item (question/approval) the user may act on now. */
  actionable: boolean;
  onAnswer(toolCallId: string, answer: Answer): void;
  onApproval(toolCallId: string, approved: boolean): void;
}

const FOCUSABLE = "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])";

/** Maps one domain chat part to its page-local view. */
export function PartView({ part, year, actionable, onAnswer, onApproval }: PartViewProps) {
  const { t } = useTranslation("common");
  // When a question/approval becomes the item to act on, move the keyboard to its first control.
  const gate = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (actionable) gate.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [actionable]);
  switch (part.kind) {
    case "text":
      return <p className="message-text">{part.text}</p>;
    case "question":
      return part.answer ? (
        <AnswerSummary question={part.question} answer={part.answer} />
      ) : (
        <div ref={gate}>
          <QuestionCard
            question={part.question}
            disabled={!actionable}
            onAnswer={(a) => onAnswer(part.question.toolCallId, a)}
          />
        </div>
      );
    case "approval": {
      const { approval } = part;
      if (approval.approved === undefined) {
        return (
          <div ref={gate}>
            <ApprovalCard
              approval={approval}
              disabled={!actionable}
              onApprove={() => onApproval(approval.toolCallId, true)}
              onDeny={() => onApproval(approval.toolCallId, false)}
            />
          </div>
        );
      }
      return (
        <p>
          <Badge tone={approval.approved ? "success" : "danger"}>
            {approval.approved ? t("chat.approval.approved") : t("chat.approval.denied")}
          </Badge>
        </p>
      );
    }
    case "mapping":
      return <EntriesView mapping={part.mapping} />;
    case "checklist":
      return <ChecklistView checklist={part.checklist} />;
    case "deduction":
      return <DeductionChip deduction={part.deduction} />;
    case "exportResult":
      return <ExportDownloads result={part.result} year={year} />;
    case "toolError":
      return <ToolErrorNotice part={part} />;
    case "toolStatus":
      return <ToolChip part={part} />;
  }
}
