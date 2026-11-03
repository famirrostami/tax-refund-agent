import { forwardRef, HTMLAttributes, ReactNode, useId } from "react";
import { cx } from "../../../lib";

export interface FormFieldIds {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: (ids: FormFieldIds) => ReactNode;
}

export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { label, hint, error, children, className, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasHint = Boolean(hint);
  const hasError = Boolean(error);
  const describedBy = [hasHint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div ref={ref} className={cx("form-field", className)} {...rest}>
      <label className="form-field__label" htmlFor={id}>{label}</label>
      {children({ id, describedBy, invalid: hasError })}
      {hasHint ? <div id={hintId} className="form-field__hint">{hint}</div> : null}
      {hasError ? <div id={errorId} role="alert" className="form-field__error">{error}</div> : null}
    </div>
  );
});
