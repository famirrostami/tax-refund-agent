import { ChangeEvent, DragEvent, forwardRef, HTMLAttributes, useRef, useState } from "react";
import { cx } from "../../../lib";
import { Button, Spinner } from "../../atoms";

export interface DropZoneProps extends Omit<HTMLAttributes<HTMLDivElement>, "onDrop"> {
  onFiles: (files: File[]) => void;
  label: string;
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  disabled?: boolean;
  busyLabel?: string;
}

export const DropZone = forwardRef<HTMLDivElement, DropZoneProps>(function DropZone(
  { onFiles, label, accept, multiple, busy, disabled, busyLabel, children, className, ...rest },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inactive = Boolean(disabled || busy);

  const over = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!inactive) setDragging(true);
  };
  const leave = () => setDragging(false);
  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (inactive) return;
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) onFiles(files);
  };
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!inactive && files.length > 0) onFiles(files);
  };

  return (
    <div
      ref={ref}
      className={cx("drop-zone", className)}
      data-dragging={dragging ? "true" : undefined}
      aria-busy={busy ? true : undefined}
      onDragEnter={over}
      onDragOver={over}
      onDragLeave={leave}
      onDrop={drop}
      {...rest}
    >
      <input
        ref={inputRef}
        type="file"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        accept={accept}
        multiple={multiple}
        onChange={pick}
      />
      {children}
      <Button tone="primary" disabled={inactive} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      {busy && busyLabel ? <Spinner aria-label={busyLabel} /> : null}
    </div>
  );
});
