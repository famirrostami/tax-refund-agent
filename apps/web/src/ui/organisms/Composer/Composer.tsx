import { FormEvent, forwardRef, KeyboardEvent, ReactNode, Ref } from "react";
import { cx } from "../../../lib";
import { Button, TextInput } from "../../atoms";

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  sendLabel: string;
  inputLabel: string;
  /** Disables the whole composer, input included. */
  disabled?: boolean;
  /** Blocks sending (button and shortcut) while the input stays editable, so focus and the draft survive. */
  sendDisabled?: boolean;
  canSend?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  attachments?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export const Composer = forwardRef<HTMLFormElement, ComposerProps>(function Composer(
  {
    value,
    onChange,
    onSend,
    placeholder,
    sendLabel,
    inputLabel,
    disabled = false,
    sendDisabled = false,
    canSend,
    inputRef,
    attachments,
    footer,
    className,
  },
  ref,
) {
  const allowed = !disabled && !sendDisabled && (canSend ?? value.trim().length > 0);
  const send = () => {
    if (allowed) onSend();
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  };
  return (
    <form ref={ref} className={cx("composer", className)} onSubmit={onSubmit}>
      {attachments ? <div className="composer__attachments">{attachments}</div> : null}
      <div className="composer__row">
        <TextInput
          ref={inputRef}
          multiline
          className="composer__input"
          rows={2}
          value={value}
          placeholder={placeholder}
          aria-label={inputLabel}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" tone="primary" disabled={!allowed}>
          {sendLabel}
        </Button>
      </div>
      {footer ? <div className="composer__footer">{footer}</div> : null}
    </form>
  );
});
