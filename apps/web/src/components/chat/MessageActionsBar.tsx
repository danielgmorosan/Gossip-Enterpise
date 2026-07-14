import { useRef, useState, type ReactNode } from "react";
import { Copy, Check, Share2, Trash2 } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";

/**
 * Per-message hover actions: Copy (raw text) + Share (quoted text with
 * attribution — and the real channel URL where one exists; there are no
 * per-message deep links yet, so Share deliberately falls back to text
 * rather than inventing a route). Purely client-side clipboard writes —
 * no storage/transport changes.
 *
 * `children` lets a surface prepend its own actions (e.g. channel "Reply").
 */
export function MessageActionsBar({
  copyText,
  shareText,
  className,
  children,
}: {
  copyText: string;
  shareText: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "items-center gap-0.5 rounded-control border border-line bg-paper p-0.5 shadow-[var(--st-shadow-card)]",
        className,
      )}
    >
      {children}
      <ClipboardBtn label="Copy text" payload={copyText}>
        <Copy className="size-3.5" />
      </ClipboardBtn>
      <ClipboardBtn label="Share (copies quote)" payload={shareText}>
        <Share2 className="size-3.5" />
      </ClipboardBtn>
    </div>
  );
}

/** Two-step delete: first click arms (turns red), second confirms. Auto-disarms. */
export function ArmDeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Tooltip label={armed ? "Click again to delete" : "Delete message"}>
      <button
        onClick={() => {
          if (armed) {
            if (timer.current) clearTimeout(timer.current);
            setArmed(false);
            onConfirm();
          } else {
            setArmed(true);
            timer.current = setTimeout(() => setArmed(false), 2500);
          }
        }}
        aria-label={armed ? "Confirm delete" : "Delete message"}
        className={cn(
          "grid size-7 place-items-center rounded-[calc(var(--radius-control)-2px)] transition-colors",
          armed ? "bg-negative text-white" : "text-ink-mute hover:bg-field hover:text-negative",
        )}
      >
        <Trash2 className="size-3.5" />
      </button>
    </Tooltip>
  );
}

/** Inline message editor: Enter saves, Esc cancels. */
export function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-0.5 w-full max-w-2xl">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) onSave(value);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={2}
        className="w-full resize-none rounded-control border border-line bg-paper-2 px-2.5 py-1.5 text-[14px] text-ink outline-none focus:border-line-strong focus:ring-2 focus:ring-[color:var(--st-ring)]"
      />
      <div className="mt-0.5 text-[11px] text-ink-faint">Enter to save · Esc to cancel</div>
    </div>
  );
}

function ClipboardBtn({ label, payload, children }: { label: string; payload: string; children: ReactNode }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const write = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setDone(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1500);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  return (
    <Tooltip label={done ? "Copied!" : label}>
      <button
        type="button"
        onClick={() => void write()}
        aria-label={label}
        className={cn(
          "grid size-7 place-items-center rounded-[calc(var(--radius-control)-2px)] transition-colors",
          done ? "text-positive" : "text-ink-mute hover:bg-field hover:text-ink",
        )}
      >
        {done ? <Check className="size-3.5" /> : children}
      </button>
    </Tooltip>
  );
}
