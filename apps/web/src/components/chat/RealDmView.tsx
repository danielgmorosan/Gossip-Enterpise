import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, Lock, Loader2, SendHorizontal } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { Avatar, Button } from "@gossip/ui/stack";
import { gossipSdk, SdkEventType, MessageDirection, type Message } from "@/lib/sdk";
import { useSession } from "@/stores/useSession";
import { cn, formatTime, truncateHandle } from "@/lib/utils";

function E2EPill() {
  return (
    <span className="ml-1 inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
      <span className="size-1.5 rounded-full bg-positive" /> live · E2E
    </span>
  );
}

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
        <PaneHeader title={isSelf ? "Notes to Self" : (peerName ?? "Direct message")} badge={<E2EPill />} />
        <div className="grid flex-1 place-items-center p-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink">
              <Lock className="size-6" />
            </span>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">Session locked</h2>
            <p className="mt-1 text-[14px] text-ink-mute">Open your encrypted session to use real messaging.</p>
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
            <span className="grid size-7 place-items-center rounded-control bg-ink text-paper"><ShieldCheck className="size-4" /></span>
          ) : (
            <Avatar name={peerName || peerId} id={peerId} className="!size-7 !text-[11px]" />
          )
        }
        title={title}
        subtitle={<span className="font-mono text-[11px]">{isSelf ? (userId ? `${userId.slice(0, 16)}…` : "") : truncateHandle(peerId, 14, 8)}</span>}
        badge={<E2EPill />}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto mb-6 flex max-w-lg flex-col items-center gap-2 rounded-card border border-line bg-paper-2 p-4 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-ink text-paper"><ShieldCheck className="size-5" /></span>
          <div className="text-[14px] font-semibold text-ink">{isSelf ? "Real end-to-end encryption" : "End-to-end encrypted"}</div>
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            {isSelf
              ? "Encrypted and stored locally by the live gossip-sdk (post-quantum keys)."
              : "Messages are sealed with post-quantum keys and forward secrecy over the Gossip network. No server can read them."}
          </p>
        </div>

        {pending && (
          <div className="mx-auto mb-4 max-w-lg rounded-control bg-field px-3 py-2 text-center text-[12.5px] text-ink-mute">
            Establishing a secure session… messages send once {peerName || "they"} come online.
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {messages.length === 0 && (
            <p className="py-10 text-center text-[13px] text-ink-faint">
              {isSelf ? "No notes yet — write one below." : "No messages yet — say hello."}
            </p>
          )}
          {messages.map((m, i) => {
            const mine = isSelf || m.direction === MessageDirection.OUTGOING;
            return (
              <div key={m.id ?? i} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && <div className="w-7 shrink-0"><Avatar name={peerName || peerId} id={peerId} className="!size-7 !text-[11px]" /></div>}
                <div
                  className={cn(
                    "relative max-w-[68%] px-3.5 py-2 text-[14px] leading-relaxed",
                    mine ? "rounded-card rounded-br-md bg-ink text-paper" : "rounded-card rounded-bl-md bg-field text-ink",
                  )}
                >
                  <span className="whitespace-pre-wrap">{m.content}</span>
                  <span className={cn("ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px]", mine ? "text-paper/60" : "text-ink-faint")}>
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
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-card border border-line bg-paper-2 px-4 py-2.5 transition-colors focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[color:var(--st-ring)]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isSelf ? "Message yourself — encrypted for real…" : `Message ${peerName || "contact"} — E2E…`}
            className="min-w-0 flex-1 bg-transparent py-1 text-[14px] text-ink outline-none placeholder:text-ink-faint"
          />
          <span className="hidden items-center gap-1 font-mono text-[10px] text-ink-faint sm:inline-flex">
            <ShieldCheck className="size-3 text-positive" /> E2E
          </span>
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className={cn("grid size-8 place-items-center rounded-control transition-colors", draft.trim() && !sending ? "bg-ink text-paper hover:bg-ink-hover" : "bg-field text-ink-faint")}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
