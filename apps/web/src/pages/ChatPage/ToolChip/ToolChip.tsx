import { useTranslation } from "react-i18next";
import type { ChatPart } from "../../../domain";
import { Badge, Spinner } from "../../../ui/atoms";

export interface ToolChipProps {
  part: ChatPart & { kind: "toolStatus" };
}

const IN_PROGRESS = new Set(["input-streaming", "input-available", "approval-responded"]);

export function ToolChip({ part }: ToolChipProps) {
  const { t } = useTranslation("common");
  const names: Record<string, string> = {
    searchRules: t("chat.tool.name.searchRules"),
    checkDeductibility: t("chat.tool.name.checkDeductibility"),
    mapToFormFields: t("chat.tool.name.mapToFormFields"),
    buildChecklist: t("chat.tool.name.buildChecklist"),
    classifyExpense: t("chat.tool.name.classifyExpense"),
    extractReceipt: t("chat.tool.name.extractReceipt"),
    buildExport: t("chat.tool.name.buildExport"),
  };
  const states: Record<string, string> = {
    "input-streaming": t("chat.tool.state.input-streaming"),
    "input-available": t("chat.tool.state.input-available"),
    "output-available": t("chat.tool.state.output-available"),
    "output-error": t("chat.tool.state.output-error"),
    "output-denied": t("chat.tool.state.output-denied"),
    "approval-requested": t("chat.tool.state.approval-requested"),
    "approval-responded": t("chat.tool.state.approval-responded"),
  };
  const name = Object.hasOwn(names, part.toolName) ? names[part.toolName] : part.toolName;
  const state = Object.hasOwn(states, part.state) ? states[part.state] : part.state;
  const tone = part.state === "output-error" || part.state === "output-denied" ? "danger" : "neutral";
  return (
    <Badge tone={tone} data-tool={part.toolName}>
      {IN_PROGRESS.has(part.state) ? <Spinner aria-label={t("chat.tool.working")} /> : null}
      <span>{name}</span> <span>{state}</span>
    </Badge>
  );
}
