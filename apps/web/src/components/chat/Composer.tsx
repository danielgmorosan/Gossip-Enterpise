import { useState } from "react";
import { SendHorizontal, ShieldCheck, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function Composer({
  placeholder,
  e2e,
  onSend,
}: {
  placeholder: string;
  e2e?: boolean;
  onSend?: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSend?.(text);
    setValue("");
  };
  return (
    <div className="px-4 pb-4 pt-1">
      <div className="rounded-card border border-line bg-paper-2 transition-colors focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[color:var(--st-ring)]">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
            {e2e ? <ShieldCheck className="size-3.5 text-positive" /> : <Shield className="size-3.5" />}
            {e2e ? "End-to-end encrypted" : "Workspace-confidential"}
          </span>
          <button
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send"
            className={cn(
              "grid size-8 place-items-center rounded-control transition-colors",
              value.trim()
                ? "bg-ink text-paper hover:bg-ink-hover"
                : "bg-field text-ink-faint",
            )}
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
