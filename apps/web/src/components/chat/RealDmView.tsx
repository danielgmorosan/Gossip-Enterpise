import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, Lock, Loader2, SendHorizontal } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { Avatar, Badge, Button } from "@gossip/ui";
import { gossipSdk, SdkEventType, MessageDirection, type Message } from "@/lib/sdk";
import { useSession } from "@/stores/useSession";
import { cn, formatTime, truncateHandle } from "@/lib/utils";

/**
 * Real, SDK-backed conversation. peerId === "self" → selfMessages (Notes to Self).
 * Otherwise a real 1:1 E2E DM with a contact (messages service over the relay).
 */
export function RealDmView({ peerId, peerName }: { peerId: string; peerName?: string }) {
  const isSelf = peerId === "self";
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!gossipSdk.isSessionOpen) return;
    try {
      if (isSelf) {
        await gossipSdk.selfMessages.ensureDiscussionExists();
        setMessages(await gossipSdk.selfMessages.getMessages());
      } else {
        setMessages(await gossipSdk.messages.getVisibleMessages(peerId));
      }
    } catch (e) {
      console.error("load messages failed", e);
    }
  }, [isSelf, peerId]);

  useEffect(() => {
    if (status !== "open") return;
    refresh();
    const onChange = () => refresh();
    const evts = [
      SdkEventType.MESSAGE_SENT,
      SdkEventType.MESSAGE_RECEIVED,
      SdkEventType.MESSAGE_UPDATED,
      SdkEventType.MESSAGE_DELETED,
      SdkEventType.MESSAGE_ACKNOWLEDGED,
      SdkEventType.SESSION_CREATED,
    ];
    evts.forEach((e) => gossipSdk.on(e, onChange));
    return () => evts.forEach((e) => gossipSdk.off(e, onChange));
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
      if (isSelf) await gossipSdk.selfMessages.send(text);
      else await gossipSdk.messages.sendText(peerId, text);
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
        <PaneHeader title={isSelf ? "Notes to Self" : (peerName ?? "Direct message")} badge={<Badge tone="accent" dot className="ml-1">E2E</Badge>} />
        <div className="grid flex-1 place-items-center p-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[color:var(--accent-faint)] text-accent">
              <Lock className="size-6" />
            </span>
            <h2 className="mt-3 font-display text-xl font-bold text-text">Session locked</h2>
            <p className="mt-1 text-[14px] text-muted">Open your encrypted session to use real messaging.</p>
            <Link to="/identity/unlock"><Button className="mt-4">Unlock session</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const title = isSelf ? "Notes to Self" : (peerName || truncateHandle(peerId, 12, 6));
  const pending = !isSelf && messages.some((m) => m.direction === MessageDirection.OUTGOING && String(m.status) === "waiting_session");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        icon={
          isSelf ? (
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink"><ShieldCheck className="size-4" /></span>
          ) : (
            <Avatar name={peerName || peerId} id={peerId} size={28} />
          )
        }
        title={title}
        subtitle={<span className="font-mono text-[11px]">{isSelf ? (userId ? `${userId.slice(0, 16)}…` : "") : truncateHandle(peerId, 14, 8)}</span>}
        badge={<Badge tone="accent" dot className="ml-1">live · E2E</Badge>}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto mb-6 flex max-w-lg flex-col items-center gap-2 rounded-2xl border border-[color:var(--accent)]/25 bg-[color:var(--accent-faint)] p-4 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink"><ShieldCheck className="size-5" /></span>
          <div className="text-[14px] font-semibold text-text">{isSelf ? "Real end-to-end encryption" : "End-to-end encrypted"}</div>
          <p className="text-[12.5px] leading-relaxed text-muted">
            {isSelf
              ? "Encrypted and stored locally by the live gossip-sdk (post-quantum keys)."
              : "Messages are sealed with post-quantum keys and forward secrecy over the Gossip network. No server can read them."}
          </p>
        </div>

        {pending && (
          <div className="mx-auto mb-4 max-w-lg rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-center text-[12.5px] text-warning">
            Establishing a secure session… messages send once {peerName || "they"} come online.
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.length === 0 && (
            <p className="py-10 text-center text-[13px] text-faint">
              {isSelf ? "No notes yet — write one below." : "No messages yet — say hello."}
            </p>
          )}
          {messages.map((m, i) => {
            const mine = isSelf || m.direction === MessageDirection.OUTGOING;
            return (
              <div key={m.id ?? i} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && <div className="w-7 shrink-0"><Avatar name={peerName || peerId} id={peerId} size={28} /></div>}
                <div
                  className={cn(
                    "relative max-w-[68%] px-3.5 py-2 text-[14.5px] leading-relaxed shadow-sm",
                    mine ? "rounded-2xl rounded-br-md bg-accent text-accent-ink" : "rounded-2xl rounded-bl-md bg-slate text-text",
                  )}
                >
                  <span className="whitespace-pre-wrap">{m.content}</span>
                  <span className={cn("ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px]", mine ? "text-accent-ink/60" : "text-faint")}>
                    {formatTime(new Date(m.timestamp))}
                    {mine && <Check className="size-3" />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-5">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-surface-inset px-4 py-2.5 focus-within:border-[color:var(--accent)] focus-within:ring-2 focus-within:ring-[color:var(--accent-glow)]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isSelf ? "Message yourself — encrypted for real…" : `Message ${peerName || "contact"} — E2E…`}
            className="min-w-0 flex-1 bg-transparent py-1 text-[14.5px] text-text outline-none placeholder:text-faint"
          />
          <span className="hidden font-mono text-[10px] text-faint sm:block">🔒 E2E</span>
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className={cn("grid size-8 place-items-center rounded-lg transition-colors", draft.trim() && !sending ? "bg-accent text-accent-ink hover:bg-accent-bright" : "bg-slate text-faint")}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
