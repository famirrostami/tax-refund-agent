import { useTranslation } from "react-i18next";
import type { FormEntry, MappingResult } from "../../../domain";
import { formatNumber } from "../../../lib";
import { Link } from "../../../ui/atoms";
import { Notice } from "../../../ui/molecules";
import { List, Table } from "../../../ui/organisms";

export interface EntriesViewProps {
  mapping: MappingResult;
}

export function EntriesView({ mapping }: EntriesViewProps) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language;

  const formatValue = (e: FormEntry): string => {
    switch (e.unit) {
      case "EUR":
        return formatNumber(e.value, lang, { style: "currency", currency: "EUR" });
      case "days":
        return t("chat.entries.unitDays", { value: formatNumber(e.value, lang) });
      case "km":
        return t("chat.entries.unitKm", { value: formatNumber(e.value, lang) });
      default:
        return String(e.value);
    }
  };

  const rows = mapping.entries.map((e) => ({
    form: e.form,
    line: e.line === null ? t("chat.entries.noLine") : e.line,
    field: (
      <>
        <span lang="de">{e.labelDe}</span>
        <br />
        <small lang="en">{e.labelEn}</small>
      </>
    ),
    value: formatValue(e),
  }));

  return (
    <div className="entries-view">
      <Table
        caption={t("chat.entries.caption")}
        columns={[
          { key: "form", header: t("chat.entries.form") },
          { key: "line", header: t("chat.entries.line") },
          { key: "field", header: t("chat.entries.field") },
          { key: "value", header: t("chat.entries.value"), align: "end" },
        ]}
        rows={rows}
        rowKey={(_, i) => mapping.entries[i]?.fieldId ?? String(i)}
        emptyLabel={t("chat.entries.empty")}
        scrollLabel={t("chat.entries.scrollLabel")}
      />
      {mapping.formStatus === "pending" ? <p>{t("chat.entries.pendingNote")}</p> : null}
      {mapping.warnings.length > 0 ? (
        <Notice tone="warning">
          {mapping.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </Notice>
      ) : null}
      {mapping.notMapped.length > 0 ? (
        <>
          <h4>{t("chat.entries.notMapped")}</h4>
          <List items={mapping.notMapped.map((n) => ({ key: n.ruleId, content: `${n.ruleId}: ${n.reason}` }))} />
        </>
      ) : null}
      {mapping.missingInfo.length > 0 ? (
        <>
          <h4>{t("chat.entries.missingInfo")}</h4>
          <List
            items={mapping.missingInfo.map((m) => ({ key: `${m.ruleId}:${m.field}`, content: `${m.field}: ${m.description}` }))}
          />
        </>
      ) : null}
      {mapping.informational.length > 0 ? (
        <>
          <h4>{t("chat.entries.informational")}</h4>
          <List items={mapping.informational.map((n) => ({ key: n.ruleId, content: `${n.ruleId}: ${n.note}` }))} />
        </>
      ) : null}
      <p>
        {t("chat.entries.source")}:{" "}
        <Link href={mapping.source.url} external>
          {mapping.source.label}
        </Link>
      </p>
    </div>
  );
}
