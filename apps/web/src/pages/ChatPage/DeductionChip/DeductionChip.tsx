import { useTranslation } from "react-i18next";
import type { DeductionCheck } from "../../../domain";
import { formatNumber } from "../../../lib";
import { Badge, Link } from "../../../ui/atoms";
import { Card, List } from "../../../ui/organisms";
import type { BadgeTone } from "../../../ui/atoms";

export interface DeductionChipProps {
  deduction: DeductionCheck;
}

export function DeductionChip({ deduction }: DeductionChipProps) {
  const { t, i18n } = useTranslation("common");
  const review = deduction.verdict === "needs_review";
  const verdictLabel =
    deduction.verdict === "deductible"
      ? t("chat.deduction.verdict.deductible")
      : deduction.verdict === "not_deductible"
        ? t("chat.deduction.verdict.not_deductible")
        : t("chat.deduction.verdict.needs_review");
  const levelLabel =
    deduction.confidence === "high"
      ? t("chat.deduction.level.high")
      : deduction.confidence === "medium"
        ? t("chat.deduction.level.medium")
        : t("chat.deduction.level.low");
  const tone: BadgeTone = review ? "warning" : "neutral";
  const showAmount = !review && deduction.amount !== null;

  return (
    <Card tone={review ? "warning" : "neutral"} data-verdict={deduction.verdict} aria-label={verdictLabel}>
      <p>
        <Badge tone={tone}>{verdictLabel}</Badge> <Badge tone="neutral">{t("chat.deduction.confidence", { level: levelLabel })}</Badge>
        {showAmount && deduction.amount !== null ? (
          <>
            {" "}
            <span>
              {t("chat.deduction.amount", {
                amount: formatNumber(deduction.amount, i18n.language, { style: "currency", currency: deduction.currency }),
              })}
            </span>
          </>
        ) : null}
      </p>
      <p>{deduction.explanation}</p>
      {deduction.missingInfo.length > 0 ? (
        <>
          <h4>{t("chat.deduction.missingInfo")}</h4>
          <List items={deduction.missingInfo.map((m) => ({ key: m.field, content: m.description }))} />
        </>
      ) : null}
      {deduction.caveats.length > 0 ? (
        <>
          <h4>{t("chat.deduction.caveats")}</h4>
          <List items={deduction.caveats.map((c, i) => ({ key: String(i), content: c }))} />
        </>
      ) : null}
      {deduction.sources.length > 0 ? (
        <>
          <h4>{t("chat.deduction.sources")}</h4>
          <List
            items={deduction.sources.map((s) => ({
              key: s.url,
              content: (
                <Link href={s.url} external>
                  {s.label}
                </Link>
              ),
            }))}
          />
        </>
      ) : null}
    </Card>
  );
}
