import { forwardRef, HTMLAttributes } from "react";
import { cx } from "../../../lib";

export type VisuallyHiddenProps = HTMLAttributes<HTMLSpanElement>;

export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(function VisuallyHidden(
  { className, ...rest },
  ref,
) {
  return <span ref={ref} className={cx("visually-hidden", className)} {...rest} />;
});
