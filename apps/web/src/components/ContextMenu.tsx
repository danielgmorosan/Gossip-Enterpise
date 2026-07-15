import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button, StackModal, ModalBody } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";

/** Right-click menu (T3): positioned at the cursor, Esc/click-away closes. */
export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}

export function ContextMenu({
  x,
  y,
  items,
  header,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  header?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const width = 220;
  const left = Math.min(x, window.innerWidth - width - 8);
  const top = Math.min(y, window.innerHeight - (items.length * 36 + 48));

  return (
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        style={{ left, top, width }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute rounded-card border border-line bg-paper p-1.5 font-stack shadow-[var(--st-shadow-card)]"
      >
        {header && <div className="truncate px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{header}</div>}
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => {
              onClose();
              it.onClick();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[13px] transition-colors",
              it.danger ? "text-negative hover:bg-negative/10" : "text-ink-soft hover:bg-field hover:text-ink",
            )}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Light confirmation dialog for destructive actions (T3). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Return an error string to keep the dialog open and show it. */
  onConfirm: () => Promise<string | null> | string | null | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const res = await onConfirm();
    setBusy(false);
    if (typeof res === "string") setError(res);
    else onClose();
  };

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
        <div className="mt-2 text-[14px] leading-relaxed text-ink-mute">{body}</div>
        {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} {confirmLabel}
          </Button>
        </div>
      </ModalBody>
    </StackModal>
  );
}
