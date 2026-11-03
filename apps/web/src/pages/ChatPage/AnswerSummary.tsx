import { useTranslation } from "react-i18next";
import type { Answer, Question } from "../../domain";
import { formatNumber } from "../../lib";
import { Card } from "../../ui/organisms";

export interface AnswerSummaryProps {
  question: Question;
  answer: Answer;
}

/** Read-only view of an answered question. */
export function AnswerSummary({ question, answer }: AnswerSummaryProps) {
  const { t, i18n } = useTranslation("common");

  const valueText = (value: string | number | boolean): string => {
    if (typeof value === "boolean") return value ? t("chat.question.yes") : t("chat.question.no");
    if (typeof value === "number") {
      const n = formatNumber(value, i18n.language);
      return question.unit ? t("chat.question.valueWithUnit", { value: n, unit: question.unit }) : n;
    }
    return question.choices?.find((c) => c.value === value)?.label ?? value;
  };

  const text = answer.answered
    ? t("chat.question.answered", { value: valueText(answer.value) })
    : answer.reason === "skipped"
      ? t("chat.question.answeredSkipped")
      : t("chat.question.answeredDontKnow");

  return (
    <Card header={<h3>{question.question}</h3>}>
      <p>{text}</p>
    </Card>
  );
}
