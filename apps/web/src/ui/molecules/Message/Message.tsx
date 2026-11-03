import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../../lib";

export type MessageRole = "user" | "assistant";

type LabelProps = { "aria-label": string; "aria-labelledby"?: string } | { "aria-label"?: string; "aria-labelledby": string };

export type MessageProps = Omit<HTMLAttributes<HTMLElement>, "role" | "aria-label" | "aria-labelledby"> &
  LabelProps & {
    role: MessageRole;
    header?: ReactNode;
    footer?: ReactNode;
  };

export const Message = forwardRef<HTMLElement, MessageProps>(function Message(
  { role, header, footer, children, className, ...rest },
  ref,
) {
  return (
    <article ref={ref} data-role={role} className={cx("message", `message--${role}`, className)} {...rest}>
      {header ? <header className="message__header">{header}</header> : null}
      <div className="message__body">{children}</div>
      {footer ? <footer className="message__footer">{footer}</footer> : null}
    </article>
  );
});
