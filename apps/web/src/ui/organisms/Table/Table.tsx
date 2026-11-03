import { forwardRef, ReactNode } from "react";
import { cx } from "../../../lib";

export interface TableColumn {
  key: string;
  header: string;
  align?: "start" | "end";
}
export type TableRow = Record<string, ReactNode>;

export interface TableProps {
  caption: string;
  columns: TableColumn[];
  rows: TableRow[];
  rowKey?: (row: TableRow, index: number) => string;
  emptyLabel: string;
  scrollLabel?: string;
  className?: string;
}

export const Table = forwardRef<HTMLDivElement, TableProps>(function Table(
  { caption, columns, rows, rowKey, emptyLabel, scrollLabel, className },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("table-wrap", className)}
      tabIndex={scrollLabel ? 0 : undefined}
      role={scrollLabel ? "group" : undefined}
      aria-label={scrollLabel}
    >
      <table className="table">
        <caption className="table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="table__th" data-align={c.align ?? "start"}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="table__empty" colSpan={columns.length}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey ? rowKey(row, i) : i}>
                {columns.map((c) => (
                  <td key={c.key} className="table__td" data-align={c.align ?? "start"}>
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});
