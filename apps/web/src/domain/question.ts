export type AnswerType = "text" | "number" | "boolean" | "choice" | "date";

export type Question = {
  toolCallId: string;
  question: string;
  field?: string;
  answerType: AnswerType;
  choices?: { value: string; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
};

export type Answer =
  | { answered: true; value: string | number | boolean }
  | { answered: false; reason: "skipped" | "dont_know" };
