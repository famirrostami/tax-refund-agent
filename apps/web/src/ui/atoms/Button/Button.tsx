import { ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "../../../lib";

export type ButtonTone = "primary" | "neutral" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = "neutral", size = "md", className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cx("btn", `btn--${tone}`, `btn--${size}`, className)} {...rest} />;
});
