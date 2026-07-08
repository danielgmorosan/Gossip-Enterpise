import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ShieldCheck, Check, Lock, Phone } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageBody } from "@/components/chat/MessageBody";
import { MessageActionsBar, ArmDeleteButton, EditBox } from "@/components/chat/MessageActionsBar";
import { Pencil } from "lucide-react";
import { Button } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { gossipSdk, SdkEventType, MessageDirection, MessageType, type Message } from "@/lib/sdk";
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
  const { workspaceId = "" } = useParams();
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.userId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** SDK marks edits via metadata.edited (set by messages.editMessage). */
  const isEdited = (m: Message): boolean =>
    typeof m.metadata === "object" && m.metadata !== null && (m.metadata as Record<string, unknown>).edited === true;

  const saveEdit = async (id: number, text: string) => {
    setEditingId(null);
    try {
      await gossipSdk.messages.editMessage(id, text);
      await refresh();
    } catch (e) {
      console.error("edit failed", e);
    }
  };

  const deleteMsg = async (id: number) => {
    try {
      await gossipSdk.messages.deleteMessage(id);
      await refresh();
    } catch (e) {
      console.error("delete failed", e);
    }
  };

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

  const send = async (text: string) => {
    if (!text || sending) return;
    setSending(true);
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
        actions={
          !isSelf && workspaceId ? (
            <Link to={`/w/${workspaceId}/call/dm/${encodeURIComponent(peerId)}`}>
              <HeaderIconButton label={`Call ${peerName || "contact"}`}>
                <Phone className="size-4" />
              </HeaderIconButton>
            </Link>
          ) : undefined
        }
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
            const deleted = m.type === MessageType.DELETED;
            const attribution = mine ? "me" : (peerName || truncateHandle(peerId, 12, 6));
            // Edit/delete go through the gossip-sdk only (E2E control messages);
            // SDK enforces author-only. Not offered for Notes-to-Self (separate service).
            const canMutate = mine && !isSelf && !deleted && m.id != null;
            const actions = !deleted ? (
              <MessageActionsBar
                copyText={m.content}
                shareText={`"${m.content}"\n— ${attribution}, ${formatTime(new Date(m.timestamp))}`}
                className="hidden shrink-0 self-center group-hover:flex"
              >
                {canMutate && (
                  <button
                    onClick={() => setEditingId(m.id!)}
                    title="Edit message"
                    aria-label="Edit message"
                    className="grid size-7 place-items-center rounded-[calc(var(--radius-control)-2px)] text-ink-mute transition-colors hover:bg-field hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {canMutate && <ArmDeleteButton onConfirm={() => void deleteMsg(m.id!)} />}
              </MessageActionsBar>
            ) : null;
            if (editingId != null && editingId === m.id) {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="w-full max-w-[68%]">
                    <EditBox initial={m.content} onSave={(text) => void saveEdit(m.id!, text)} onCancel={() => setEditingId(null)} />
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id ?? i} className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && <div className="w-7 shrink-0"><Avatar name={peerName || peerId} id={peerId} className="!size-7 !text-[11px]" /></div>}
                {mine && actions}
                <div
                  className={cn(
                    "relative max-w-[68%] px-3.5 py-2 text-[14px] leading-relaxed",
                    mine ? "rounded-card rounded-br-md bg-ink text-paper" : "rounded-card rounded-bl-md bg-field text-ink",
                  )}
                >
                  {deleted ? (
                    <span className={cn("text-[13px] italic", mine ? "text-paper/60" : "text-ink-faint")}>message deleted</span>
                  ) : (
                    <>
                      <MessageBody text={m.content} />
                      {isEdited(m) && (
                        <span className={cn("ml-1.5 text-[10.5px]", mine ? "text-paper/60" : "text-ink-faint")}>(edited)</span>
                      )}
                    </>
                  )}
                  <span className={cn("ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px]", mine ? "text-paper/60" : "text-ink-faint")}>
                    {formatTime(new Date(m.timestamp))}
                    {mine && !deleted && <Check className="size-3" />}
                  </span>
                </div>
                {!mine && actions}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <Composer
          placeholder={isSelf ? "Message yourself — encrypted for real…" : `Message ${peerName || "contact"} — E2E…`}
          e2e
          busy={sending}
          onSend={(text) => void send(text)}
          attachNotice="Attachments aren't available in E2E DMs yet — the Gossip SDK doesn't support them."
        />
      </div>
    </div>
  );
}
