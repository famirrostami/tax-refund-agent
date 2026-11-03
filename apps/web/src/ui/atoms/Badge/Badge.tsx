import { forwardRef, HTMLAttributes } from "react";
import { cx } from "../../../lib";

export type BadgeTone = "neutral" | "info" | "warning" | "danger" | "success";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "neutral", className, ...rest },
  ref,
) {
  return <span ref={ref} className={cx("badge", `badge--${tone}`, className)} {...rest} />;
});
