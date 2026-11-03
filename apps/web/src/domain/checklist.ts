export type ChecklistItem = {
  id: string;
  kind: "document" | "information";
  text: string;
  why?: string;
  official: boolean;
  status: "have" | "missing";
};

export type ChecklistResult = {
  taxYear: number;
  uploadSteps: { text: string; source: { label: string; url: string } }[];
  perRule: { ruleId: string; title: string; items: ChecklistItem[] }[];
  skipped: { ruleId: string; reason: string }[];
  missingCount: number;
  warnings: string[];
};
