import { useTranslation } from "react-i18next";
import { exportUrl } from "../../../api";
import type { ExportFileName } from "../../../api";
import type { ExportResult } from "../../../domain";
import { Link } from "../../../ui/atoms";
import { Notice } from "../../../ui/molecules";
import { List } from "../../../ui/organisms";

export interface ExportDownloadsProps {
  result: ExportResult;
  year: number;
}

const KNOWN: readonly ExportFileName[] = ["summary.md", "entries.csv", "export.json"];
const isKnown = (n: string): n is ExportFileName => (KNOWN as readonly string[]).includes(n);

export function ExportDownloads({ result, year }: ExportDownloadsProps) {
  const { t } = useTranslation("common");
  const labels: Record<ExportFileName, string> = {
    "summary.md": t("chat.export.file.summaryMd"),
    "entries.csv": t("chat.export.file.entriesCsv"),
    "export.json": t("chat.export.file.exportJson"),
  };
  const files = result.exportId ? result.files.filter(isKnown) : [];
  return (
    <div className="export-downloads">
      <p>
        {t("chat.export.summary", { count: result.entryCount })}, {t("chat.export.documents", { count: result.documentCount })},{" "}
        {t("chat.export.notMapped", { count: result.notMappedCount })}
      </p>
      {result.warnings.length > 0 ? (
        <Notice tone="warning">
          {result.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </Notice>
      ) : null}
      <List
        items={files.map((name) => ({
          key: name,
          content: (
            <Link href={exportUrl(result.exportId, name, year)} download={name}>
              {labels[name]}
            </Link>
          ),
        }))}
      />
    </div>
  );
}
