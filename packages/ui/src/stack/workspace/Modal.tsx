import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils";

export function StackModal({
  children,
  onClose,
  className,
  width = "lg",
}: {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  width?: "md" | "lg" | "xl";
}) {
  const widths = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-3xl" };

  // Escape closes, like every modal people know.
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-6 pt-[10vh]"
      onMouseDown={(e) => {
        // Backdrop click closes (only when the press starts on the backdrop
        // itself — dragging out of an input never dismisses the dialog).
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal
        className={cn(
          "relative w-full rounded-card border border-line bg-paper shadow-[var(--st-shadow-card)]",
          widths[width],
          className,
        )}
      >
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-control p-1.5 text-ink-faint hover:bg-field hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  breadcrumb,
  icon,
  className,
}: {
  breadcrumb?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-line px-6 py-4", className)}>
      {breadcrumb}
      {icon && <div className="mt-3 text-ink-mute [&_svg]:size-5">{icon}</div>}
    </div>
  );
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function ModalFooter({
  start,
  end,
  className,
}: {
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-line px-6 py-4",
        className,
      )}
    >
      <div>{start}</div>
      <div className="flex items-center gap-2">{end}</div>
    </div>
  );
}

/** Inline creation card (initiative / project) — not necessarily in a modal. */
export function CreationCard({
  icon,
  title,
  titlePlaceholder = "Title…",
  description,
  descriptionPlaceholder = "Add a description…",
  chips,
  footer,
  className,
}: {
  icon?: ReactNode;
  title?: string;
  titlePlaceholder?: string;
  description?: string;
  descriptionPlaceholder?: string;
  chips?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-paper p-5 shadow-[var(--st-shadow-card)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="mt-1 text-ink-mute [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0 flex-1">
          {title !== undefined ? (
            <p className="text-[15px] font-semibold text-ink">{title}</p>
          ) : (
            <input
              type="text"
              placeholder={titlePlaceholder}
              className="w-full bg-transparent text-[15px] font-semibold text-ink placeholder:text-ink-faint outline-none"
            />
          )}
          {description !== undefined ? (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{description}</p>
          ) : (
            <textarea
              rows={2}
              placeholder={descriptionPlaceholder}
              className="mt-2 w-full resize-none bg-transparent text-[14px] text-ink-soft placeholder:text-ink-faint outline-none"
            />
          )}
          {chips && <div className="mt-4 flex flex-wrap gap-1.5">{chips}</div>}
        </div>
      </div>
      {footer && <div className="mt-4 flex items-center justify-between gap-3">{footer}</div>}
    </div>
  );
}

export function MilestonesBar({
  label = "Milestones",
  onAdd,
  className,
}: {
  label?: string;
  onAdd?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        "flex w-full items-center justify-between rounded-control border border-line",
        "bg-field px-4 py-3 text-[13px] text-ink-mute hover:border-line-strong hover:text-ink",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
        className,
      )}
    >
      <span>{label}</span>
      <span className="text-lg leading-none text-ink-faint">+</span>
    </button>
  );
}
