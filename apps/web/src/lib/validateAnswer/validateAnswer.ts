export type AnswerSpec = {
  answerType: "text" | "number" | "boolean" | "choice" | "date";
  choices?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export type AnswerReason = "required" | "not_a_number" | "ambiguous_number" | "too_small" | "too_large" | "not_a_choice" | "not_a_date";

export type AnswerResult =
  | { ok: true; value: string | number | boolean }
  | { ok: false; reason: AnswerReason };

const fail = (reason: AnswerReason): AnswerResult => ({ ok: false, reason });

/** Validates a raw answer against its spec. Returns a reason code, never user-facing text. */
export function validateAnswer(spec: AnswerSpec, raw: string | boolean): AnswerResult {
  if (spec.answerType === "boolean") {
    return typeof raw === "boolean" ? { ok: true, value: raw } : fail("required");
  }
  if (typeof raw !== "string") return fail("required");
  const text = raw.trim();
  if (text === "") return fail("required");

  switch (spec.answerType) {
    case "text":
      return { ok: true, value: text };
    case "number": {
      // "1,000" / "1.000" / "1.000,50" could mean a thousand or a decimal depending on locale: never guess.
      const hasBoth = text.includes(",") && text.includes(".");
      if (hasBoth || /^[+-]?[1-9]\d{0,2}([.,]\d{3})+$/.test(text)) return fail("ambiguous_number");
      const normalized = text.replace(",", ".");
      if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return fail("not_a_number");
      const n = Number(normalized);
      if (!Number.isFinite(n)) return fail("not_a_number");
      if (spec.min !== undefined && n < spec.min) return fail("too_small");
      if (spec.max !== undefined && n > spec.max) return fail("too_large");
      return { ok: true, value: n };
    }
    case "choice":
      return spec.choices?.some((c) => c.value === text) ? { ok: true, value: text } : fail("not_a_choice");
    case "date": {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (!m) return fail("not_a_date");
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const dt = new Date(Date.UTC(y, mo - 1, d));
      const valid = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
      return valid ? { ok: true, value: text } : fail("not_a_date");
    }
  }
}
