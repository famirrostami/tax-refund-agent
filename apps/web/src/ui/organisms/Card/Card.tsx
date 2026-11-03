import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../../lib";

export type CardTone = "neutral" | "info" | "warning" | "danger";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  header?: ReactNode;
  actions?: ReactNode;
  tone?: CardTone;
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { header, actions, tone = "neutral", children, className, ...rest },
  ref,
) {
  return (
    <section ref={ref} className={cx("card", `card--${tone}`, className)} {...rest}>
      {header ? <div className="card__header">{header}</div> : null}
      <div className="card__body">{children}</div>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </section>
  );
});
