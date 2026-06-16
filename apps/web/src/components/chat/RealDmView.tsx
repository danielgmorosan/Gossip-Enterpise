import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, Lock, Loader2, SendHorizontal } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { Badge, Button } from "@gossip/ui";
import { gossipSdk, SdkEventType, type Message } from "@/lib/sdk";
import { useSession } from "@/stores/useSession";
import { cn, formatTime } from "@/lib/utils";

/**
 * A real, SDK-backed conversation: "Notes to Self". Uses the gossip-sdk
 * selfMessages service — genuine post-quantum E2E encryption + local persistence,
 * fully verifiable without a second device or the relay.
 */
export function RealDmView() {
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!gossipSdk.isSessionOpen) return;
    try {
      await gossipSdk.selfMessages.ensureDiscussionExists();
      setMessages(await gossipSdk.selfMessages.getMessages());
    } catch (e) {
      console.error("selfMessages load failed", e);
    }
  }, []);

  useEffect(() => {
    if (status !== "open") return;
    refresh();
    const onChange = () => refresh();
    gossipSdk.on(SdkEventType.MESSAGE_SENT, onChange);
    gossipSdk.on(SdkEventType.MESSAGE_RECEIVED, onChange);
    gossipSdk.on(SdkEventType.MESSAGE_UPDATED, onChange);
    gossipSdk.on(SdkEventType.MESSAGE_DELETED, onChange);
    return () => {
      gossipSdk.off(SdkEventType.MESSAGE_SENT, onChange);
      gossipSdk.off(SdkEventType.MESSAGE_RECEIVED, onChange);
      gossipSdk.off(SdkEventType.MESSAGE_UPDATED, onChange);
      gossipSdk.off(SdkEventType.MESSAGE_DELETED, onChange);
    };
  }, [status, refresh]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      await gossipSdk.selfMessages.send(text);
      await refresh();
    } catch (e) {
      console.error("send failed", e);
    } finally {
      setSending(false);
    }
  };

  if (status !== "open") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PaneHeader title="Notes to Self" badge={<Badge tone="accent" dot className="ml-1">E2E</Badge>} />
        <div className="grid flex-1 place-items-center p-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[color:var(--accent-faint)] text-accent">
              <Lock className="size-6" />
            </span>
            <h2 className="mt-3 font-display text-xl font-bold text-text">Session locked</h2>
            <p className="mt-1 text-[14px] text-muted">
              Open your encrypted session to use real messaging.
            </p>
            <Link to="/identity/unlock">
              <Button className="mt-4">Unlock session</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        icon={
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
            <ShieldCheck className="size-4" />
          </span>
        }
        title="Notes to Self"
        subtitle={<span className="font-mono text-[11px]">{userId ? `${userId.slice(0, 16)}…` : ""}</span>}
        badge={<Badge tone="accent" dot className="ml-1">live · E2E</Badge>}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto mb-6 flex max-w-lg flex-col items-center gap-2 rounded-2xl border border-[color:var(--accent)]/25 bg-[color:var(--accent-faint)] p-4 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink">
            <ShieldCheck className="size-5" />
          </span>
          <div className="text-[14px] font-semibold text-text">Real end-to-end encryption</div>
          <p className="text-[12.5px] leading-relaxed text-muted">
            These messages are encrypted and persisted by the live gossip-sdk (post-quantum keys),
            entirely on this device. This is the inherited Gossip stack, running for real.
          </p>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.length === 0 && (
            <p className="py-10 text-center text-[13px] text-faint">
              No messages yet — send one below to exercise the real crypto pipeline.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={m.id ?? i} className="flex items-end justify-end gap-2">
              <div className="relative max-w-[68%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[14.5px] leading-relaxed text-accent-ink shadow-sm">
                <span className="whitespace-pre-wrap">{m.content}</span>
                <span className="ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px] text-accent-ink/60">
                  {formatTime(new Date(m.timestamp))}
                  <Check className="size-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-5">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-2.5 focus-within:border-[color:var(--accent)] focus-within:ring-2 focus-within:ring-[color:var(--accent-glow)]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message yourself — encrypted for real…"
            className="min-w-0 flex-1 bg-transparent py-1 text-[14.5px] text-text outline-none placeholder:text-faint"
          />
          <span className="hidden font-mono text-[10px] text-faint sm:block">🔒 E2E</span>
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className={cn(
              "grid size-8 place-items-center rounded-lg transition-colors",
              draft.trim() && !sending ? "bg-accent text-accent-ink hover:bg-accent-bright" : "bg-slate text-faint",
            )}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
