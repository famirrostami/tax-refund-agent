import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../../lib";
import { Badge, Button } from "../../atoms";

export interface FileChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  name: string;
  removeLabel: string;
  onRemove?: () => void;
  status?: ReactNode;
}

export const FileChip = forwardRef<HTMLSpanElement, FileChipProps>(function FileChip(
  { name, removeLabel, onRemove, status, className, ...rest },
  ref,
) {
  return (
    <Badge ref={ref} className={cx("file-chip", className)} {...rest}>
      <span className="file-chip__name">{name}</span>
      {status ? <span className="file-chip__status">{status}</span> : null}
      {onRemove ? (
        <Button size="sm" className="file-chip__remove" aria-label={removeLabel} onClick={onRemove}>
          <svg aria-hidden="true" focusable="false" width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </Button>
      ) : null}
    </Badge>
  );
});
