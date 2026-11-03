import type {
  Answer, Approval, ChatPart, ChecklistResult, DeductionCheck, ExportResult, MappingResult, Question,
} from "../../domain";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const recArr = (v: unknown): v is Rec[] => Array.isArray(v) && v.every(isRec);
const link = (v: unknown) => isRec(v) && isStr(v["label"]) && isStr(v["url"]);

const ANSWER_TYPES = ["text", "number", "boolean", "choice", "date"];
const VERDICTS = ["deductible", "not_deductible", "needs_review"];

function toQuestion(input: unknown, toolCallId: string): Question | null {
  if (!isRec(input) || !isStr(input["question"]) || !ANSWER_TYPES.includes(input["answerType"] as string)) return null;
  const q: Question = { toolCallId, question: input["question"], answerType: input["answerType"] as Question["answerType"] };
  if (isStr(input["field"])) q.field = input["field"];
  if (isStr(input["unit"])) q.unit = input["unit"];
  if (isNum(input["min"])) q.min = input["min"];
  if (isNum(input["max"])) q.max = input["max"];
  if (recArr(input["choices"]) && input["choices"].every((c) => isStr(c["value"]) && isStr(c["label"]))) {
    q.choices = input["choices"].map((c) => ({ value: c["value"] as string, label: c["label"] as string }));
  }
  return q;
}

function toAnswer(o: unknown): Answer | undefined {
  if (!isRec(o)) return undefined;
  if (o["answered"] === true && (isStr(o["value"]) || isNum(o["value"]) || typeof o["value"] === "boolean")) return { answered: true, value: o["value"] };
  if (o["answered"] === false && (o["reason"] === "skipped" || o["reason"] === "dont_know")) return { answered: false, reason: o["reason"] };
  return undefined;
}

function toMapping(o: Rec): MappingResult | null {
  const entriesOk = recArr(o["entries"]) && o["entries"].every((e) =>
    isStr(e["form"]) && isStr(e["section"]) && isStr(e["fieldId"]) && (e["line"] === null || isStr(e["line"])) &&
    typeof e["lineVerified"] === "boolean" && isStr(e["labelDe"]) && isStr(e["labelEn"]) && isStr(e["unit"]) && isNum(e["value"]) && strArr(e["ruleIds"]));
  if (!(o["ok"] === true && entriesOk && isNum(o["taxYear"]) && (o["formStatus"] === "published" || o["formStatus"] === "pending") && link(o["source"]) &&
    recArr(o["informational"]) && recArr(o["notMapped"]) && recArr(o["missingInfo"]) && strArr(o["warnings"]))) return null;
  return {
    taxYear: o["taxYear"] as number,
    formStatus: o["formStatus"] as MappingResult["formStatus"],
    source: o["source"] as MappingResult["source"],
    entries: o["entries"] as MappingResult["entries"],
    informational: o["informational"] as MappingResult["informational"],
    notMapped: o["notMapped"] as MappingResult["notMapped"],
    missingInfo: o["missingInfo"] as MappingResult["missingInfo"],
    warnings: o["warnings"] as string[],
  };
}

function toChecklist(o: Rec): ChecklistResult | null {
  const perRuleOk = recArr(o["perRule"]) && o["perRule"].every((r) => isStr(r["ruleId"]) && isStr(r["title"]) && recArr(r["items"]) &&
    r["items"].every((i) => isStr(i["id"]) && isStr(i["text"]) && typeof i["official"] === "boolean" && (i["status"] === "have" || i["status"] === "missing")));
  if (!(o["ok"] === true && perRuleOk && isNum(o["taxYear"]) && recArr(o["uploadSteps"]) && recArr(o["skipped"]) && isNum(o["missingCount"]) && strArr(o["warnings"]))) return null;
  return {
    taxYear: o["taxYear"] as number,
    uploadSteps: o["uploadSteps"] as ChecklistResult["uploadSteps"],
    perRule: o["perRule"] as ChecklistResult["perRule"],
    skipped: o["skipped"] as ChecklistResult["skipped"],
    missingCount: o["missingCount"] as number,
    warnings: o["warnings"] as string[],
  };
}

function toDeduction(o: Rec): DeductionCheck | null {
  if (!(o["ok"] === true && VERDICTS.includes(o["verdict"] as string) && (o["amount"] === null || isNum(o["amount"])) && isStr(o["currency"]) && isStr(o["ruleId"]) &&
    isNum(o["taxYear"]) && ["high", "medium", "low"].includes(o["confidence"] as string) && recArr(o["missingInfo"]) && isStr(o["explanation"]) &&
    isRec(o["breakdown"]) && strArr(o["caveats"]) && recArr(o["sources"]))) return null;
  return {
    verdict: o["verdict"] as DeductionCheck["verdict"],
    amount: o["amount"] as number | null,
    currency: o["currency"] as string,
    ruleId: o["ruleId"] as string,
    taxYear: o["taxYear"] as number,
    confidence: o["confidence"] as DeductionCheck["confidence"],
    missingInfo: o["missingInfo"] as DeductionCheck["missingInfo"],
    explanation: o["explanation"] as string,
    breakdown: o["breakdown"] as DeductionCheck["breakdown"],
    caveats: o["caveats"] as string[],
    sources: o["sources"] as DeductionCheck["sources"],
  };
}

function toExport(o: Rec): ExportResult | null {
  if (!(o["ok"] === true && isStr(o["exportId"]) && strArr(o["files"]) && isNum(o["entryCount"]) && isNum(o["documentCount"]) && isNum(o["notMappedCount"]) && strArr(o["warnings"]))) return null;
  return { exportId: o["exportId"] as string, files: o["files"] as string[], entryCount: o["entryCount"] as number, documentCount: o["documentCount"] as number, notMappedCount: o["notMappedCount"] as number, warnings: o["warnings"] as string[] };
}

function toolPart(part: Rec, toolName: string): ChatPart {
  const state = isStr(part["state"]) ? part["state"] : "unknown";
  const status: ChatPart = { kind: "toolStatus", toolName, state };
  const toolCallId = part["toolCallId"];
  if (!isStr(toolCallId)) return status;
  const out = isRec(part["output"]) ? part["output"] : null;

  if (toolName === "askUser" && (state === "input-available" || state === "output-available")) {
    const question = toQuestion(part["input"], toolCallId);
    if (!question) return status;
    const answer = state === "output-available" ? toAnswer(part["output"]) : undefined;
    return answer ? { kind: "question", question, answer } : { kind: "question", question };
  }
  if (toolName === "buildExport" && (state === "approval-requested" || state === "approval-responded" || state === "output-denied")) {
    const approval = part["approval"];
    if (!isRec(approval) || !isStr(approval["id"])) return status;
    const input = part["input"];
    const items = isRec(input) && recArr(input["items"]) ? input["items"] : [];
    const mapped: Approval = { approvalId: approval["id"], toolCallId, toolName, ruleIds: items.map((i) => i["ruleId"]).filter(isStr) };
    if (state === "output-denied") mapped.approved = false;
    else if (state === "approval-responded") {
      if (typeof approval["approved"] !== "boolean") return status;
      mapped.approved = approval["approved"];
    }
    return { kind: "approval", approval: mapped };
  }
  if (state !== "output-available" || !out) return status;
  if (out["ok"] === false && isStr(out["code"]) && isStr(out["message"])) {
    return { kind: "toolError", toolCallId, toolName, code: out["code"], message: out["message"] };
  }
  switch (toolName) {
    case "mapToFormFields": { const mapping = toMapping(out); return mapping ? { kind: "mapping", toolCallId, mapping } : status; }
    case "buildChecklist": { const checklist = toChecklist(out); return checklist ? { kind: "checklist", toolCallId, checklist } : status; }
    case "checkDeductibility": { const deduction = toDeduction(out); return deduction ? { kind: "deduction", toolCallId, deduction } : status; }
    case "buildExport": { const result = toExport(out); return result ? { kind: "exportResult", toolCallId, result } : status; }
    default: return status;
  }
}

/** Maps AI SDK UI message parts to the app's chat parts. Never throws; anything unrecognised degrades to `toolStatus`. */
export function toChatParts(uiParts: unknown[]): ChatPart[] {
  const out: ChatPart[] = [];
  for (const part of uiParts) {
    if (!isRec(part) || !isStr(part["type"])) continue;
    if (part["type"] === "text" && isStr(part["text"])) out.push({ kind: "text", text: part["text"] });
    else if (part["type"].startsWith("tool-")) out.push(toolPart(part, part["type"].slice(5)));
  }
  return out;
}
