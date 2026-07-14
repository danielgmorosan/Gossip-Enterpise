import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../utils";

type Side = "top" | "bottom" | "left" | "right";

const positions: Record<Side, string> = {
  top: "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-1.5 -translate-x-1/2",
  left: "right-full top-1/2 mr-1.5 -translate-y-1/2",
  right: "left-full top-1/2 ml-1.5 -translate-y-1/2",
};

export interface StackTooltipProps {
  /** Short action label, e.g. "Bold (Ctrl+B)". */
  label: ReactNode;
  /** Placement relative to the trigger. Pick the side with room: headers → bottom, docks → top, rails → right. */
  side?: Side;
  /** Hover open delay in ms. Keyboard focus always opens immediately. */
  delay?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Stack tooltip for icon-only controls. Opens on hover (after a short delay)
 * and on keyboard focus (immediately); dismisses on Esc, blur, or mouse-out.
 * The trigger gets `aria-describedby` pointing at the `role="tooltip"` bubble
 * while it is visible. Inverse-ink bubble per the monochrome token set.
 *
 * Usage: wrap exactly one focusable trigger —
 *   <Tooltip label="Delete"><button aria-label="Delete">…</button></Tooltip>
 */
export function Tooltip({ label, side = "top", delay = 350, className, children }: StackTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (afterMs: number) => {
    if (timer.current) clearTimeout(timer.current);
    if (afterMs <= 0) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), afterMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Point the trigger at the bubble for screen readers while visible.
  const trigger =
    isValidElement(children) && open
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": id })
      : children;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => show(delay)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Escape") hide();
      }}
    >
      {trigger}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "st-tooltip pointer-events-none absolute z-50 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)]",
            "bg-inverse px-2 py-1 text-[11px] font-medium leading-none text-inverse-ink",
            "shadow-[var(--st-shadow-card)]",
            positions[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
