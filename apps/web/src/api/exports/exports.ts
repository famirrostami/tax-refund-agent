export type ExportFileName = "summary.md" | "entries.csv" | "export.json";

/** Download URL of one file of a stored export. */
export function exportUrl(exportId: string, name: ExportFileName, year: number): string {
  return `/api/exports/${encodeURIComponent(exportId)}/${name}?year=${year}`;
}
