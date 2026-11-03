import { forwardRef, SelectHTMLAttributes } from "react";
import { cx } from "../../../lib";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx("select", className)} {...rest} />;
});
