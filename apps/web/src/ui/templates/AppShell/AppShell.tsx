import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../../lib";

export interface AppShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export const AppShell = forwardRef<HTMLDivElement, AppShellProps>(function AppShell(
  { header, footer, children, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx("app-shell", className)} {...rest}>
      {header ? <header className="app-shell__header">{header}</header> : null}
      <main className="app-shell__main">{children}</main>
      {footer ? <footer className="app-shell__footer">{footer}</footer> : null}
    </div>
  );
});
