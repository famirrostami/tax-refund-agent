import { forwardRef, HTMLAttributes } from "react";
import { cx } from "../../../lib";

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "aria-label"> {
  "aria-label": string;
}

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner({ className, ...rest }, ref) {
  return <span ref={ref} role="status" className={cx("spinner", className)} {...rest} />;
});
