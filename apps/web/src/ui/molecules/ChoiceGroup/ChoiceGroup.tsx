import { FieldsetHTMLAttributes, forwardRef, useId } from "react";
import { cx } from "../../../lib";

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
}

export interface ChoiceGroupProps
  extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange" | "value" | "children" | "name"> {
  options: ChoiceOption[];
  value: string | null;
  onChange: (value: string) => void;
  name: string;
  legend: string;
}

export const ChoiceGroup = forwardRef<HTMLFieldSetElement, ChoiceGroupProps>(function ChoiceGroup(
  { options, value, onChange, name, legend, disabled, className, ...rest },
  ref,
) {
  const uid = useId();
  return (
    <fieldset ref={ref} disabled={disabled} className={cx("choice-group", className)} {...rest}>
      <legend className="choice-group__legend">{legend}</legend>
      {options.map((opt, i) => {
        const descId = opt.description ? `${uid}-${i}-desc` : undefined;
        return (
          <div key={opt.value} className="choice-group__option">
            <input
              type="radio"
              className="choice-group__input"
              id={`${uid}-${i}`}
              name={name}
              value={opt.value}
              checked={value === opt.value}
              aria-describedby={descId}
              onChange={() => onChange(opt.value)}
            />
            <label className="choice-group__label" htmlFor={`${uid}-${i}`}>{opt.label}</label>
            {opt.description ? <span id={descId} className="choice-group__description">{opt.description}</span> : null}
          </div>
        );
      })}
    </fieldset>
  );
});
