import { Children, forwardRef, HTMLAttributes, ReactNode, Ref, useCallback, useEffect, useRef } from "react";
import { cx } from "../../../lib";

export interface ChatLogProps extends Omit<HTMLAttributes<HTMLDivElement>, "role"> {
  "aria-label": string;
  emptyContent?: ReactNode;
}

const BOTTOM_THRESHOLD = 24;

export const ChatLog = forwardRef<HTMLDivElement, ChatLogProps>(function ChatLog(
  { children, emptyContent, className, onScroll, ...rest },
  ref,
) {
  const el = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
    [ref],
  );

  useEffect(() => {
    const node = el.current;
    if (node && stick.current) node.scrollTop = node.scrollHeight;
  }, [children]);

  const empty = Children.toArray(children).length === 0;
  return (
    <div
      ref={setRef as Ref<HTMLDivElement>}
      role="log"
      aria-live="polite"
      className={cx("chat-log", className)}
      onScroll={(e) => {
        const n = e.currentTarget;
        stick.current = n.scrollHeight - n.scrollTop - n.clientHeight <= BOTTOM_THRESHOLD;
        onScroll?.(e);
      }}
      {...rest}
    >
      {empty ? emptyContent : children}
    </div>
  );
});
