export type FormEntry = {
  form: string;
  section: string;
  fieldId: string;
  /** null when the official line number is not published (e.g. tax year 2026). */
  line: string | null;
  lineVerified: boolean;
  labelDe: string;
  labelEn: string;
  unit: "EUR" | "days" | "km" | "text";
  value: number;
  ruleIds: string[];
  note?: string;
};

export type MappingResult = {
  taxYear: number;
  formStatus: "published" | "pending";
  source: { label: string; url: string };
  entries: FormEntry[];
  informational: { ruleId: string; note: string }[];
  notMapped: { ruleId: string; reason: string }[];
  missingInfo: { ruleId: string; field: string; description: string }[];
  warnings: string[];
};
