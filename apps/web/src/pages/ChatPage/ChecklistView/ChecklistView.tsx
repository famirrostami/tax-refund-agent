import { useTranslation } from "react-i18next";
import type { ChecklistResult } from "../../../domain";
import { Badge, Link } from "../../../ui/atoms";
import { Notice } from "../../../ui/molecules";
import { Card, List } from "../../../ui/organisms";

export interface ChecklistViewProps {
  checklist: ChecklistResult;
}

export function ChecklistView({ checklist }: ChecklistViewProps) {
  const { t } = useTranslation("common");
  return (
    <div className="checklist-view">
      <p>{t("chat.checklist.missingCount", { count: checklist.missingCount })}</p>
      {checklist.perRule.map((rule) => (
        <Card key={rule.ruleId} aria-label={rule.title} header={<h3>{rule.title}</h3>}>
          <List
            items={rule.items.map((item) => ({
              key: item.id,
              content: (
                <>
                  <span>{item.text}</span>{" "}
                  <Badge tone={item.status === "have" ? "success" : "warning"}>
                    {item.status === "have" ? t("chat.checklist.have") : t("chat.checklist.missing")}
                  </Badge>{" "}
                  {item.official ? (
                    <Badge tone="neutral">{t("chat.checklist.official")}</Badge>
                  ) : (
                    <>
                      <Badge tone="info">{t("chat.checklist.recommended")}</Badge>{" "}
                      <small>{t("chat.checklist.recommendedHint")}</small>
                    </>
                  )}
                  {item.why ? (
                    <p>
                      <small>{t("chat.checklist.why", { why: item.why })}</small>
                    </p>
                  ) : null}
                </>
              ),
            }))}
          />
        </Card>
      ))}
      <h4>{t("chat.checklist.uploadSteps")}</h4>
      <List
        ordered
        items={checklist.uploadSteps.map((s, i) => ({
          key: String(i),
          content: (
            <>
              {s.text}{" "}
              <Link href={s.source.url} external>
                {s.source.label}
              </Link>
            </>
          ),
        }))}
      />
      {checklist.skipped.length > 0 ? (
        <>
          <h4>{t("chat.checklist.skipped")}</h4>
          <List items={checklist.skipped.map((s) => ({ key: s.ruleId, content: `${s.ruleId}: ${s.reason}` }))} />
        </>
      ) : null}
      {checklist.warnings.length > 0 ? (
        <Notice tone="warning">
          {checklist.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </Notice>
      ) : null}
    </div>
  );
}
