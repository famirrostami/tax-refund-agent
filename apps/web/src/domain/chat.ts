import type { Approval } from "./approval";
import type { ChecklistResult } from "./checklist";
import type { DeductionCheck } from "./deductionCheck";
import type { MappingResult } from "./formEntry";
import type { Answer, Question } from "./question";

export type ExportResult = {
  exportId: string;
  files: string[];
  entryCount: number;
  documentCount: number;
  notMappedCount: number;
  warnings: string[];
};

export type ChatPart =
  | { kind: "text"; text: string }
  | { kind: "question"; question: Question; answer?: Answer }
  | { kind: "approval"; approval: Approval }
  | { kind: "mapping"; toolCallId: string; mapping: MappingResult }
  | { kind: "checklist"; toolCallId: string; checklist: ChecklistResult }
  | { kind: "deduction"; toolCallId: string; deduction: DeductionCheck }
  | { kind: "exportResult"; toolCallId: string; result: ExportResult }
  | { kind: "toolError"; toolCallId: string; toolName: string; code: string; message: string }
  | { kind: "toolStatus"; toolName: string; state: string };
