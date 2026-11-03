import { useAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useHealth } from "../../api";
import { selectedYearAtom } from "../../state";
import { Button, Spinner } from "../../ui/atoms";
import { Notice } from "../../ui/molecules";
import { AppShell } from "../../ui/templates";
import { Conversation } from "./Conversation";

/** The single chat screen: picks the tax year from /api/health, then mounts one conversation per year. */
export function ChatPage() {
  const { t } = useTranslation("common");
  const health = useHealth();
  const [year, setYear] = useAtom(selectedYearAtom);
  const years = health.data?.years;
  const first = years?.[0];

  useEffect(() => {
    if (year === null && first !== undefined) setYear(first);
  }, [year, first, setYear]);

  if (years && year !== null && years.length > 0) return <Conversation key={year} year={year} years={years} />;

  let body;
  if (health.isError) {
    body = (
      <Notice
        tone="danger"
        actions={
          <Button tone="primary" onClick={() => void health.refetch()}>
            {t("chat.health.retry")}
          </Button>
        }
      >
        {t("chat.health.error")}
      </Notice>
    );
  } else if (years && years.length === 0) {
    body = <Notice tone="danger">{t("chat.health.noYears")}</Notice>;
  } else {
    body = <Spinner aria-label={t("chat.health.loading")} />;
  }
  return <AppShell header={<h1>{t("app.title")}</h1>}>{body}</AppShell>;
}
