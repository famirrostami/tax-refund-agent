import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "../../../lib";

interface Common {
  invalid?: boolean;
}
export type SingleLineProps = Common & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
export type MultiLineProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };
export type TextInputProps = SingleLineProps | MultiLineProps;

export const TextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextInputProps>(function TextInput(
  props,
  ref,
) {
  if (props.multiline) {
    const { multiline: _m, invalid, className, ...rest } = props;
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={cx("input", "input--multiline", className)}
        aria-invalid={invalid ? true : undefined}
        {...rest}
      />
    );
  }
  const { multiline: _m, invalid, className, ...rest } = props;
  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      className={cx("input", className)}
      aria-invalid={invalid ? true : undefined}
      {...rest}
    />
  );
});
