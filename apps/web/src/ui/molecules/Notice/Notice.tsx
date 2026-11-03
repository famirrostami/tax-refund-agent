import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../../lib";

export type NoticeTone = "info" | "warning" | "danger" | "success";

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "role"> {
  tone: NoticeTone;
  title?: ReactNode;
  actions?: ReactNode;
}

export const Notice = forwardRef<HTMLDivElement, NoticeProps>(function Notice(
  { tone, title, actions, children, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role={tone === "danger" ? "alert" : "status"}
      className={cx("notice", `notice--${tone}`, className)}
      {...rest}
    >
      {title ? <div className="notice__title">{title}</div> : null}
      <div className="notice__body">{children}</div>
      {actions ? <div className="notice__actions">{actions}</div> : null}
    </div>
  );
});
