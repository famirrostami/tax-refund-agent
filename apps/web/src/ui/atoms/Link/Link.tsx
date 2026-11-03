import { AnchorHTMLAttributes, forwardRef } from "react";
import { cx } from "../../../lib";

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  external?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ external, className, ...rest }, ref) {
  const ext = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return <a ref={ref} className={cx("link", className)} {...ext} {...rest} />;
});
