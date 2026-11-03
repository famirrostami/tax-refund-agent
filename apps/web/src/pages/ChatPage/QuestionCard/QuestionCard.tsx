import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Answer, Question } from "../../../domain";
import { formatNumber, validateAnswer, type AnswerReason } from "../../../lib";
import { questionDraftsAtomFamily } from "../../../state";
import { Button, TextInput } from "../../../ui/atoms";
import { ChoiceGroup, FormField, Notice } from "../../../ui/molecules";
import { Card } from "../../../ui/organisms";

export interface QuestionCardProps {
  question: Question;
  onAnswer(a: Answer): void;
  disabled?: boolean;
}

export function QuestionCard({ question, onAnswer, disabled }: QuestionCardProps) {
  const { t, i18n } = useTranslation("common");
  const [draft, setDraft] = useAtom(questionDraftsAtomFamily(question.toolCallId));
  const [reason, setReason] = useState<AnswerReason | null>(null);

  const fmt = (n: number) => formatNumber(n, i18n.language);
  const { min, max } = question;
  const minText = min === undefined ? "" : fmt(min);
  const maxText = max === undefined ? "" : fmt(max);

  const errorText = (r: AnswerReason): string => {
    switch (r) {
      case "required":
        return t("chat.question.error.required");
      case "not_a_number":
        return t("chat.question.error.notANumber");
      case "ambiguous_number":
        return t("chat.question.error.ambiguousNumber");
      case "too_small":
        return t("chat.question.error.tooSmall", { min: minText });
      case "too_large":
        return t("chat.question.error.tooLarge", { max: maxText });
      case "not_a_choice":
        return t("chat.question.error.notAChoice");
      case "not_a_date":
        return t("chat.question.error.notADate");
    }
  };

  const rangeText =
    question.answerType !== "number"
      ? null
      : min !== undefined && max !== undefined
        ? t("chat.question.rangeBetween", { min: minText, max: maxText })
        : min !== undefined
          ? t("chat.question.rangeMin", { min: minText })
          : max !== undefined
            ? t("chat.question.rangeMax", { max: maxText })
            : null;

  const hint =
    question.unit || rangeText ? (
      <>
        {question.unit ? <span>{t("chat.question.unit", { unit: question.unit })}</span> : null}
        {question.unit && rangeText ? " " : null}
        {rangeText ? <span>{rangeText}</span> : null}
      </>
    ) : undefined;

  const submit = () => {
    const raw: string | boolean =
      question.answerType === "boolean" ? (draft === "" ? "" : draft === "true") : draft;
    const result = validateAnswer(question, raw);
    if (!result.ok) {
      setReason(result.reason);
      return;
    }
    setReason(null);
    onAnswer({ answered: true, value: result.value });
  };

  const change = (v: string) => {
    setDraft(v);
    setReason(null);
  };

  const label = t("chat.question.answerLabel");
  const error = reason ? errorText(reason) : undefined;

  let control;
  if (question.answerType === "boolean" || question.answerType === "choice") {
    const options =
      question.answerType === "boolean"
        ? [
            { value: "true", label: t("chat.question.yes") },
            { value: "false", label: t("chat.question.no") },
          ]
        : (question.choices ?? []);
    control = (
      <>
        <ChoiceGroup
          name={question.toolCallId}
          legend={label}
          options={options}
          value={draft === "" ? null : draft}
          onChange={change}
          disabled={disabled}
        />
        {hint ? <div>{hint}</div> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </>
    );
  } else {
    control = (
      <FormField label={label} hint={hint} error={error}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            type={question.answerType === "date" ? "date" : "text"}
            inputMode={question.answerType === "number" ? "decimal" : undefined}
            value={draft}
            disabled={disabled}
            onChange={(e) => change(e.target.value)}
          />
        )}
      </FormField>
    );
  }

  return (
    <Card
      header={<h3>{question.question}</h3>}
      actions={
        <>
          <Button
            tone="neutral"
            disabled={disabled}
            onClick={() => onAnswer({ answered: false, reason: "dont_know" })}
          >
            {t("chat.question.dontKnow")}
          </Button>
          <Button tone="neutral" disabled={disabled} onClick={() => onAnswer({ answered: false, reason: "skipped" })}>
            {t("chat.question.skip")}
          </Button>
          <Button tone="primary" disabled={disabled} onClick={submit}>
            {t("chat.question.submit")}
          </Button>
        </>
      }
    >
      {control}
    </Card>
  );
}
