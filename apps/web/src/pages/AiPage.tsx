import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, ShieldCheck, FileText, ListChecks, Search, AlertTriangle } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import {
  AiChatShell,
  AiChatWelcomeLayout,
  AiChatHero,
  AiChatWatermark,
  AiSuggestionGrid,
  AiSuggestionCard,
  AiUserBubble,
  AiAssistantBlock,
  AiWorkingIndicator,
  AiPromptComposer,
} from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { aiHealth, runAiJob, type AiHealth } from "@/lib/ai";

interface Turn {
  role: "user" | "assistant";
  text: string;
  model?: string;
}

const quickPrompts: { icon: typeof FileText; label: string; desc: string; type: "recap" | "notes" | "qa"; prompt?: string }[] = [
  { icon: FileText, label: "Recap all my channels", desc: "A digest of what happened across the workspace.", type: "recap" },
  { icon: ListChecks, label: "Extract action items", desc: "Open to-dos and owners from recent messages.", type: "notes" },
  { icon: Search, label: "What decisions were made?", desc: "Decisions and who made them.", type: "qa", prompt: "What decisions have been made, and by whom?" },
];

export function AiPage() {
  const { workspaceId = "" } = useParams();
  const workspace = useRelay((s) => s.workspace);
  const channelIds = workspace?.channels.map((c) => c.id) ?? [];
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiHealth().then(setHealth).catch(() => setHealth(null));
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy]);

  const ask = async (type: "recap" | "notes" | "qa", prompt?: string, label?: string) => {
    if (busy) return;
    const userText = label ?? prompt ?? "";
    setTurns((t) => [...t, { role: "user", text: userText }]);
    setBusy(true);
    try {
      const res = await runAiJob({ workspaceId, channelScope: channelIds, type, prompt });
      setTurns((t) => [...t, { role: "assistant", text: res.text, model: res.model }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: `⚠️ ${e instanceof Error ? e.message : "Request failed"}` }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const p = input.trim();
    if (!p || busy) return;
    setInput("");
    ask("qa", p, p);
  };

  const composer = (
    <AiPromptComposer
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onSubmit={submit}
      busy={busy}
      placeholder="Ask about your channels — recap, summarize, find a decision…"
    />
  );

  const offlineNote = !health?.ok && health && (
    <div className="mb-6 flex items-start gap-3 rounded-card border border-line bg-field p-4 text-[13px] text-ink-mute">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        {!health.ollama
          ? "Ollama isn't running. Start it with `ollama serve`."
          : `Model ${health.model} isn't pulled yet. Run \`ollama pull ${health.model}\`.`}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        icon={
          <span className="grid size-7 place-items-center rounded-control bg-ink text-paper">
            <Sparkles className="size-4" />
          </span>
        }
        title="OpenClaw"
        subtitle="Self-hosted assistant · reads only channels you can access"
        badge={
          <span className={`ml-1 inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium ${health?.ok ? "text-positive" : "text-ink-mute"}`}>
            <span className={`size-1.5 rounded-full ${health?.ok ? "bg-positive" : "bg-ink-faint"}`} />
            {health?.ok ? `local · ${health.model}` : "model offline"}
          </span>
        }
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <AiChatShell watermark={turns.length === 0 ? <AiChatWatermark /> : undefined} className="min-h-full">
          {turns.length === 0 ? (
            <>
              {offlineNote}
              <AiChatWelcomeLayout
                hero={
                  <AiChatHero
                    title="Ask OpenClaw"
                    subtitle={
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="size-4 text-positive" />
                        Runs on your hardware. Reads channels you can access — never your DMs.
                      </span>
                    }
                  />
                }
                composer={composer}
                suggestions={
                  <AiSuggestionGrid title="Get started">
                    {quickPrompts.map((p) => (
                      <AiSuggestionCard
                        key={p.label}
                        icon={<p.icon />}
                        title={p.label}
                        description={p.desc}
                        onClick={() => ask(p.type, p.prompt, p.label)}
                      />
                    ))}
                  </AiSuggestionGrid>
                }
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col">
              {offlineNote}
              <div className="flex-1 space-y-8 py-2">
                {turns.map((t, i) =>
                  t.role === "user" ? (
                    <AiUserBubble key={i}>{t.text}</AiUserBubble>
                  ) : (
                    <div key={i}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-control bg-ink text-paper">
                          <Sparkles className="size-3.5" />
                        </span>
                        <span className="text-[13px] font-semibold text-ink">OpenClaw</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                          local{t.model ? ` · ${t.model}` : ""}
                        </span>
                      </div>
                      <AiAssistantBlock>
                        <span className="whitespace-pre-wrap">{t.text}</span>
                      </AiAssistantBlock>
                    </div>
                  ),
                )}
                {busy && <AiWorkingIndicator label="OpenClaw is reading your channels…" />}
              </div>
              <div className="sticky bottom-0 bg-paper pb-2 pt-4">
                <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-paper to-transparent" />
                {composer}
              </div>
            </div>
          )}
        </AiChatShell>
      </div>

      <p className="border-t border-line px-4 py-2 text-center text-[11px] text-ink-faint">
        Local model · answers cover only channels you can access, never DMs.
      </p>
    </div>
  );
}
