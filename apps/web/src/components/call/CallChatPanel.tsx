import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, MessageSquareText } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { Composer } from "@/components/chat/Composer";
import { MessageBody } from "@/components/chat/MessageBody";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { gossipSdk, SdkEventType, MessageDirection, MessageType, type Message } from "@/lib/sdk";
import { cn, formatTime, truncateHandle } from "@/lib/utils";
import type { CallTarget } from "@/stores/useCall";

/**
 * In-call text chat (T2-06). Not a separate transport: a channel call shows
 * the channel's own messages (relay), a DM call shows the E2E conversation
 * (gossip-sdk) — so chat sent here lands where it always would.
 */
export function CallChatPanel({ target, onClose }: { target: CallTarget; onClose: () => void }) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-paper">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <MessageSquareText className="size-4 text-ink-mute" />
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
          {target.kind === "channel" ? `#${target.label}` : target.label}
        </span>
        <span className="text-[10px] text-ink-faint">{target.kind === "channel" ? "channel chat" : "E2E chat"}</span>
        <Tooltip label="Hide chat" side="bottom" className="ml-auto">
          <button onClick={onClose} aria-label="Hide chat" className="grid size-7 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink">
            <X className="size-4" />
          </button>
        </Tooltip>
      </header>
      {target.kind === "channel" ? (
        <ChannelChat workspaceId={target.workspaceId} channelId={target.channelId} />
      ) : (
        <DmChat peerId={target.peerId} />
      )}
    </aside>
  );
}

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [dep]);
  return ref;
}

function ChannelChat({ workspaceId, channelId }: { workspaceId: string; channelId: string }) {
  const workspace = useRelay((s) => s.workspace);
  const messages = useRelay((s) => s.messagesByChannel[channelId]) ?? [];
  const myId = useSession((s) => s.userId);

  useEffect(() => {
    if (workspaceId && channelId) useRelay.getState().joinChannel(workspaceId, channelId);
  }, [workspaceId, channelId]);

  const feed = useMemo(() => messages.filter((m) => !m.threadRootId && !m.deleted).slice(-80), [messages]);
  const scrollRef = useAutoScroll(feed.length);
  const mentionCandidates = useMemo(
    () => (workspace?.members ?? []).map((m) => ({ id: m.userId, name: m.name })),
    [workspace?.members],
  );

  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {feed.length === 0 && <p className="py-6 text-center text-[12px] text-ink-faint">No messages yet.</p>}
        {feed.map((m) => (
          <div key={m.id} className="flex items-start gap-2 py-1">
            <Avatar name={m.senderName} id={m.senderId} className="!size-6 !text-[10px] mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className={cn("truncate text-[12px] font-semibold", m.senderId === myId ? "text-ink" : "text-ink-soft")}>
                  {m.senderName}
                </span>
                <span className="shrink-0 text-[9.5px] text-ink-faint">{formatTime(new Date(m.ts))}</span>
              </div>
              <div className="text-[13px] leading-snug text-ink">
                {m.body ? <MessageBody text={m.body} /> : m.attachment ? <span className="text-ink-mute">sent {m.attachment.name}</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Composer
        className="!px-2 !pb-2"
        placeholder="Message the channel…"
        onSend={(text) => useRelay.getState().post(workspaceId, channelId, text)}
        mentionCandidates={mentionCandidates}
      />
    </>
  );
}

function DmChat({ peerId }: { peerId: string }) {
  const status = useSession((s) => s.status);
  const contacts = useContacts((s) => s.contacts);
  const peerName = contacts.find((c) => c.userId === peerId)?.name;
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!gossipSdk.isSessionOpen) return;
    try {
      setMessages(await gossipSdk.messages.getVisibleMessages(peerId));
    } catch (e) {
      console.error("call chat: load DM messages failed", e);
    }
  }, [peerId]);

  useEffect(() => {
    if (status !== "open") return;
    void refresh();
    const onChange = () => void refresh();
    const evts = [
      SdkEventType.MESSAGE_SENT,
      SdkEventType.MESSAGE_RECEIVED,
      SdkEventType.MESSAGE_UPDATED,
      SdkEventType.MESSAGE_DELETED,
      SdkEventType.SESSION_CREATED,
    ];
    evts.forEach((e) => gossipSdk.on(e, onChange));
    return () => evts.forEach((e) => gossipSdk.off(e, onChange));
  }, [status, refresh]);

  const visible = useMemo(() => messages.filter((m) => m.type !== MessageType.DELETED).slice(-80), [messages]);
  const scrollRef = useAutoScroll(visible.length);
  const mentionCandidates = useMemo(() => contacts.map((c) => ({ id: c.userId, name: c.name })), [contacts]);

  const send = async (text: string) => {
    if (!text || sending) return;
    setSending(true);
    try {
      await gossipSdk.messages.sendText(peerId, text);
      await refresh();
    } catch (e) {
      console.error("call chat: send failed", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {visible.length === 0 && <p className="py-6 text-center text-[12px] text-ink-faint">No messages yet.</p>}
        {visible.map((m, i) => {
          const mine = m.direction === MessageDirection.OUTGOING;
          const who = mine ? "me" : peerName || truncateHandle(peerId, 8, 4);
          return (
            <div key={m.id ?? i} className="flex items-start gap-2 py-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("truncate text-[12px] font-semibold", mine ? "text-ink" : "text-ink-soft")}>{who}</span>
                  <span className="shrink-0 text-[9.5px] text-ink-faint">{formatTime(new Date(m.timestamp))}</span>
                </div>
                <div className="text-[13px] leading-snug text-ink">
                  <MessageBody text={m.content} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Composer
        className="!px-2 !pb-2"
        placeholder={`Message ${peerName || "them"} (E2E)…`}
        e2e
        busy={sending}
        onSend={(text) => void send(text)}
        attachNotice="Attachments aren't available in E2E DMs yet. The Gossip SDK doesn't support them."
        mentionCandidates={mentionCandidates}
      />
    </>
  );
}
