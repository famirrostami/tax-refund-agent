import { forwardRef, ReactNode } from "react";
import { cx } from "../../../lib";

export interface ListItem {
  key: string;
  content: ReactNode;
}

export interface ListProps {
  items: ListItem[];
  ordered?: boolean;
  emptyLabel?: string;
  className?: string;
}

export const List = forwardRef<HTMLUListElement | HTMLOListElement, ListProps>(function List(
  { items, ordered = false, emptyLabel, className },
  ref,
) {
  if (items.length === 0) {
    return emptyLabel ? <p className={cx("list-empty", className)}>{emptyLabel}</p> : null;
  }
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag ref={ref as never} className={cx("list", ordered && "list--ordered", className)}>
      {items.map((it) => (
        <li key={it.key} className="list__item">
          {it.content}
        </li>
      ))}
    </Tag>
  );
});
