import { useState } from "react";
import { Sparkles, X, ArrowUp, ShieldCheck, FileText, ListChecks, Search, Loader2 } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { MessageBody } from "@/components/chat/MessageBody";
import { runAiJob } from "@/lib/ai";

const quick: { icon: typeof FileText; label: string; type: "recap" | "notes" | "qa"; prompt?: string }[] = [
  { icon: FileText, label: "Recap this channel", type: "recap" },
  { icon: ListChecks, label: "Extract action items", type: "notes" },
  { icon: Search, label: "What was decided here?", type: "qa", prompt: "What decisions were made in this channel?" },
];

export function AiSidePanel({
  workspaceId,
  channelId,
  channelName,
  onClose,
}: {
  workspaceId: string;
  channelId: string;
  channelName: string;
  onClose: () => void;
}) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");

  const run = async (type: "recap" | "notes" | "qa", prompt?: string) => {
    if (busy) return;
    setBusy(true);
    setAnswer(null);
    try {
      const res = await runAiJob({ workspaceId, channelScope: [channelId], type, prompt });
      setAnswer(res.text);
    } catch (e) {
      setAnswer(`⚠️ ${e instanceof Error ? e.message : "Request failed"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-paper-2 font-stack max-md:absolute max-md:inset-0 max-md:z-20 max-md:w-auto max-md:border-l-0">
      <header className="flex h-12 items-center gap-2 border-b border-line px-4">
        <span className="grid size-7 place-items-center rounded-control bg-ink text-paper">
          <Sparkles className="size-4" />
        </span>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-ink">Gossip AI</div>
          <div className="font-mono text-[10px] text-ink-faint">local model</div>
        </div>
        <span className="ml-1 inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
          <span className="size-1.5 rounded-full bg-positive" /> private
        </span>
        <Tooltip label="Close" side="bottom" className="ml-auto">
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink">
            <X className="size-4" />
          </button>
        </Tooltip>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-card border border-line bg-paper p-3 text-[13px] leading-relaxed text-ink-mute">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-ink">
            <ShieldCheck className="size-4 text-positive" /> Scoped to #{channelName}
          </div>
          Runs locally; reads only this channel's history, never DMs.
        </div>

        <div className="space-y-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => run(q.type, q.prompt)}
              disabled={busy}
              className="flex w-full items-center gap-2.5 rounded-control border border-line bg-paper px-3 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-line-strong hover:bg-field disabled:opacity-50"
            >
              <q.icon className="size-4 shrink-0 text-ink-mute" />
              {q.label}
            </button>
          ))}
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-[13px] text-ink-mute">
            <Loader2 className="size-4 animate-spin" /> Reading #{channelName}…
          </div>
        )}
        {answer && (
          <div className="rounded-card bg-field p-3">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-mute">Gossip AI</div>
            {/* Same safe markdown path as chat - fenced code gets highlight + copy. */}
            <div className="text-[13px] leading-relaxed text-ink">
              <MessageBody text={answer} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-card border border-line bg-paper px-3 py-2 transition-colors focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[color:var(--st-ring)]">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                run("qa", input.trim());
                setInput("");
              }
            }}
            placeholder="Ask about this channel…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            onClick={() => {
              if (input.trim()) {
                run("qa", input.trim());
                setInput("");
              }
            }}
            disabled={busy}
            aria-label="Ask"
            className="grid size-7 place-items-center rounded-control bg-ink text-paper hover:bg-ink-hover disabled:opacity-50"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
