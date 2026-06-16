import { useState } from "react";
import { Plus, Smile, AtSign, Paperclip, SendHorizontal, Sparkles, Bold, Italic, Code } from "lucide-react";
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
      <div className="rounded-xl border border-border bg-surface-inset focus-within:border-[color:var(--accent)] focus-within:ring-2 focus-within:ring-[color:var(--accent-glow)]">
        <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5">
          {[Bold, Italic, Code].map((Icon, i) => (
            <button key={i} className="grid size-7 place-items-center rounded text-faint hover:bg-surface-raised hover:text-text">
              <Icon className="size-4" />
            </button>
          ))}
        </div>
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
          className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-2.5 text-[14.5px] text-text outline-none placeholder:text-faint"
        />
        <div className="flex items-center gap-1 px-2 py-1.5">
          {[Plus, AtSign, Smile, Paperclip].map((Icon, i) => (
            <button key={i} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-raised hover:text-text">
              <Icon className="size-[18px]" />
            </button>
          ))}
          <button className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-accent hover:bg-[color:var(--accent-faint)]">
            <Sparkles className="size-4" /> Ask AI
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-faint">
              {e2e ? "🔒 End-to-end encrypted" : "🛡 Workspace-confidential"}
            </span>
            <button
              onClick={submit}
              disabled={!value.trim()}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition-colors",
                value.trim()
                  ? "bg-accent text-accent-ink hover:bg-accent-bright"
                  : "bg-slate text-faint",
              )}
            >
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
