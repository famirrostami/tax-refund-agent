import { describe, expect, it } from "vitest";
import { toChatParts } from "./mappers";

const mapping = {
  ok: true, taxYear: 2026, formStatus: "pending", source: { label: "s", url: "u" },
  entries: [{ form: "Anlage N", section: "s", fieldId: "f", line: null, lineVerified: false, labelDe: "Pendlerpauschale", labelEn: "Commute", unit: "EUR", value: 10, ruleIds: ["r"] }],
  informational: [], notMapped: [], missingInfo: [], warnings: ["w"],
};

describe("toChatParts", () => {
  it("maps text and drops non-tool parts", () => {
    expect(toChatParts([{ type: "text", text: "hi" }, { type: "step-start" }, null, 3])).toEqual([{ kind: "text", text: "hi" }]);
  });
  it("maps askUser input-available to a question with toolCallId", () => {
    const [p] = toChatParts([{ type: "tool-askUser", toolCallId: "c1", state: "input-available", input: { question: "Km?", answerType: "number", unit: "km", min: 0 } }]);
    expect(p).toEqual({ kind: "question", question: { toolCallId: "c1", question: "Km?", answerType: "number", unit: "km", min: 0 } });
  });
  it("attaches the answer when askUser is answered", () => {
    const [p] = toChatParts([{ type: "tool-askUser", toolCallId: "c1", state: "output-available", input: { question: "Q", answerType: "boolean" }, output: { answered: true, value: true } }]);
    expect(p).toMatchObject({ kind: "question", answer: { answered: true, value: true } });
  });
  it("maps buildExport approval-requested to approval with both ids", () => {
    const [p] = toChatParts([{ type: "tool-buildExport", toolCallId: "c2", state: "approval-requested", approval: { id: "a1" }, input: { items: [{ ruleId: "r1", facts: {} }] } }]);
    expect(p).toEqual({ kind: "approval", approval: { approvalId: "a1", toolCallId: "c2", toolName: "buildExport", ruleIds: ["r1"] } });
  });
  it("keeps a responded buildExport approval as an approval part with its decision", () => {
    const input = { items: [{ ruleId: "r1" }] };
    const parts = toChatParts([
      { type: "tool-buildExport", toolCallId: "c2", state: "approval-responded", approval: { id: "a1", approved: true }, input },
      { type: "tool-buildExport", toolCallId: "c3", state: "approval-responded", approval: { id: "a2", approved: false }, input },
      { type: "tool-buildExport", toolCallId: "c4", state: "output-denied", approval: { id: "a3", approved: false }, input },
    ]);
    expect(parts).toEqual([
      { kind: "approval", approval: { approvalId: "a1", toolCallId: "c2", toolName: "buildExport", ruleIds: ["r1"], approved: true } },
      { kind: "approval", approval: { approvalId: "a2", toolCallId: "c3", toolName: "buildExport", ruleIds: ["r1"], approved: false } },
      { kind: "approval", approval: { approvalId: "a3", toolCallId: "c4", toolName: "buildExport", ruleIds: ["r1"], approved: false } },
    ]);
  });
  it("maps buildExport output to exportResult", () => {
    const out = { ok: true, exportId: "e", files: ["summary.md"], entryCount: 1, documentCount: 0, notMappedCount: 0, warnings: [] };
    const [p] = toChatParts([{ type: "tool-buildExport", toolCallId: "c", state: "output-available", output: out }]);
    expect(p).toMatchObject({ kind: "exportResult", result: { exportId: "e", files: ["summary.md"] } });
  });
  it("maps mapToFormFields output to mapping, preserving line null", () => {
    const [p] = toChatParts([{ type: "tool-mapToFormFields", toolCallId: "c", state: "output-available", output: mapping }]);
    expect(p.kind).toBe("mapping");
    if (p.kind === "mapping") {
      expect(p.mapping.entries[0]?.line).toBeNull();
      expect(p.mapping.formStatus).toBe("pending");
    }
  });
  it("preserves the needs_review verdict", () => {
    const out = { ok: true, verdict: "needs_review", amount: null, currency: "EUR", ruleId: "r", taxYear: 2026, confidence: "low", missingInfo: [{ field: "f", description: "d" }], explanation: "e", breakdown: {}, caveats: [], sources: [] };
    const [p] = toChatParts([{ type: "tool-checkDeductibility", toolCallId: "c", state: "output-available", output: out }]);
    expect(p).toMatchObject({ kind: "deduction", deduction: { verdict: "needs_review", amount: null } });
  });
  it("maps buildChecklist output", () => {
    const out = { ok: true, taxYear: 2026, keep: {}, uploadSteps: [], perRule: [{ ruleId: "r", title: "T", items: [{ id: "i", kind: "document", text: "x", official: false, status: "missing" }] }], skipped: [], missingCount: 1, warnings: [] };
    const [p] = toChatParts([{ type: "tool-buildChecklist", toolCallId: "c", state: "output-available", output: out }]);
    expect(p).toMatchObject({ kind: "checklist", checklist: { missingCount: 1, perRule: [{ items: [{ status: "missing" }] }] } });
  });
  it("turns unknown tools into toolStatus", () => {
    expect(toChatParts([{ type: "tool-searchRules", toolCallId: "c", state: "input-available" }])).toEqual([{ kind: "toolStatus", toolName: "searchRules", state: "input-available" }]);
  });
  it("falls back to toolStatus for malformed or failed outputs without throwing", () => {
    const parts = toChatParts([
      { type: "tool-mapToFormFields", toolCallId: "c", state: "output-available", output: { ok: true, entries: "nope" } },
      { type: "tool-mapToFormFields", toolCallId: "c", state: "output-available", output: { ok: false, code: "no_forms_for_year" } },
      { type: "tool-askUser", toolCallId: "c", state: "input-available", input: null },
      { type: "tool-buildExport", state: "approval-requested" },
      { type: "tool-checkDeductibility" },
    ]);
    expect(parts.map((p) => p.kind)).toEqual(["toolStatus", "toolStatus", "toolStatus", "toolStatus", "toolStatus"]);
    expect(parts[0]).toEqual({ kind: "toolStatus", toolName: "mapToFormFields", state: "output-available" });
    expect(parts[4]).toEqual({ kind: "toolStatus", toolName: "checkDeductibility", state: "unknown" });
  });
  it("maps ok:false outputs with code and message to toolError", () => {
    const parts = toChatParts([
      { type: "tool-buildExport", toolCallId: "c1", state: "output-available", output: { ok: false, code: "nothing_to_export", message: "No deductions to export." } },
      { type: "tool-mapToFormFields", toolCallId: "c2", state: "output-available", output: { ok: false, code: "no_forms_for_year", message: "No form mapping for tax year 2030." } },
      { type: "tool-checkDeductibility", toolCallId: "c3", state: "output-available", output: { ok: false, code: "rule_not_found", message: "No rule." } },
    ]);
    expect(parts).toEqual([
      { kind: "toolError", toolCallId: "c1", toolName: "buildExport", code: "nothing_to_export", message: "No deductions to export." },
      { kind: "toolError", toolCallId: "c2", toolName: "mapToFormFields", code: "no_forms_for_year", message: "No form mapping for tax year 2030." },
      { kind: "toolError", toolCallId: "c3", toolName: "checkDeductibility", code: "rule_not_found", message: "No rule." },
    ]);
  });
  it("degrades ok:false without a string message to toolStatus", () => {
    const parts = toChatParts([
      { type: "tool-buildExport", toolCallId: "c", state: "output-available", output: { ok: false, code: "nothing_to_export" } },
      { type: "tool-buildExport", toolCallId: "c", state: "output-available", output: { ok: false, code: 1, message: 2 } },
    ]);
    expect(parts).toEqual([
      { kind: "toolStatus", toolName: "buildExport", state: "output-available" },
      { kind: "toolStatus", toolName: "buildExport", state: "output-available" },
    ]);
  });
});
