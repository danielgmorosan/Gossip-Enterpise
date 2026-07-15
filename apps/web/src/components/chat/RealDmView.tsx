import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Check, Lock, Phone } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageBody } from "@/components/chat/MessageBody";
import { MessagePreviews } from "@/components/chat/LinkPreview";
import { MessageActionsBar, ArmDeleteButton, EditBox } from "@/components/chat/MessageActionsBar";
import { Pencil } from "lucide-react";
import { Button, StackToast, Tooltip } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { gossipSdk, SdkEventType, MessageDirection, MessageType, type Message } from "@/lib/sdk";
import { parseCallSignal, callSignalLabel } from "@/lib/callSignals";
import { parseImageMarker, imageMarkerBody, fileToDmImageDataUrl } from "@/lib/media";
import { dmRoomName } from "@/lib/call";
import { relayUrl } from "@/lib/relayBase";
import { useCall } from "@/stores/useCall";
import { useSession } from "@/stores/useSession";
import { useUnlockPrompt } from "@/components/UnlockDialog";
import { useLightbox } from "@/components/ImageLightbox";
import { useFileDrop } from "@/lib/useFileDrop";
import { useContacts } from "@/stores/useContacts";
import { useNotifications } from "@/stores/useNotifications";
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
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [staged, setStaged] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Dropping/picking images only STAGES them (consent + caption) — nothing is
  // encrypted or sent until the user hits Send.
  const stageImages = (files: FileList) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length < files.length) {
      setAttachNotice("Only images can be sent in E2E DMs for now.");
      setTimeout(() => setAttachNotice(null), 4000);
    }
    if (images.length) setStaged((s) => [...s, ...images]);
  };
  const drop = useFileDrop(stageImages);

  // @mention picker candidates (T2-05): your contacts.
  const contacts = useContacts((s) => s.contacts);
  const mentionCandidates = useMemo(() => contacts.map((c) => ({ id: c.userId, name: c.name })), [contacts]);

  // T2-09: viewing the conversation clears its unread badge.
  useEffect(() => {
    if (!isSelf) useNotifications.getState().clearDmUnread(peerId);
  }, [isSelf, peerId, messages.length]);

  // T3: is a call live in this DM? The room name is an opaque digest only the
  // two peers can derive, so polling its count leaks nothing to the relay.
  const [liveCallCount, setLiveCallCount] = useState(0);
  const inThisCall = useCall((s) => s.status !== "idle" && s.target?.kind === "dm" && s.target.peerId === peerId);
  useEffect(() => {
    if (isSelf || !userId || status !== "open") return;
    let on = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const room = await dmRoomName(userId, peerId);
        const r = await fetch(relayUrl(`/room-count?room=${encodeURIComponent(room)}`));
        const d = await r.json();
        if (on) setLiveCallCount(d.count ?? 0);
      } catch {
        /* relay unreachable — keep last state */
      }
      if (on) timer = setTimeout(check, 15_000);
    };
    void check();
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [isSelf, peerId, userId, status]);

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

  const sendBody = async (body: string) => {
    if (isSelf) await gossipSdk.selfMessages.send(body);
    else await gossipSdk.messages.sendText(peerId, body);
  };

  /**
   * Send text and/or staged images (T3). Images travel as compressed
   * data-URIs inside the encrypted message; the text rides as the first
   * image's caption — one E2E message, rendered as image + caption.
   */
  const send = async (text: string) => {
    if (sending) return;
    const files = staged;
    setStaged([]);
    if (!text && files.length === 0) return;
    setSending(true);
    try {
      if (files.length === 0) {
        await sendBody(text);
      } else {
        let caption = text;
        for (let i = 0; i < files.length; i++) {
          try {
            setAttachNotice(`Encrypting ${files[i].name}…`);
            const dataUrl = await fileToDmImageDataUrl(files[i]);
            await sendBody(imageMarkerBody(dataUrl, caption));
            caption = "";
            setAttachNotice(null);
          } catch (e) {
            setStaged((cur) => [...files.slice(i), ...cur]); // nothing silently lost
            setAttachNotice(e instanceof Error ? e.message : "Couldn't send that image.");
            setTimeout(() => setAttachNotice(null), 5000);
            return;
          }
        }
      }
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
            <Button className="mt-4" onClick={() => useUnlockPrompt.getState().show()}>
              Unlock session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const title = isSelf ? "Notes to Self" : (peerName || truncateHandle(peerId, 12, 6));
  const pending = !isSelf && messages.some((m) => m.direction === MessageDirection.OUTGOING && String(m.status) === "waiting_session");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" {...drop.props}>
      {drop.dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-card border-2 border-dashed border-ink bg-paper/85">
          <span className="text-[14px] font-semibold text-ink">Drop an image to send it end-to-end encrypted</span>
        </div>
      )}
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
          !isSelf ? (
            <Link to={`/home/call/dm/${encodeURIComponent(peerId)}`}>
              <HeaderIconButton label={`Call ${peerName || "contact"}`}>
                <Phone className="size-4" />
              </HeaderIconButton>
            </Link>
          ) : undefined
        }
      />

      {liveCallCount > 0 && !inThisCall && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-paper-2 px-4 py-2">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-positive" />
          </span>
          <span className="min-w-0 truncate text-[13px] text-ink">
            <span className="font-semibold">Call in progress</span>
            <span className="text-ink-mute"> · {liveCallCount} {liveCallCount === 1 ? "person" : "people"} · E2E</span>
          </span>
          <Link to={`/home/call/dm/${encodeURIComponent(peerId)}?answer=1`} className="ml-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-control bg-positive px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90">
              <Phone className="size-3.5" /> Join
            </span>
          </Link>
        </div>
      )}

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
              {isSelf ? "No notes yet. Write one below." : "No messages yet. Say hello."}
            </p>
          )}
          {messages.map((m, i) => {
            const mine = isSelf || m.direction === MessageDirection.OUTGOING;
            const deleted = m.type === MessageType.DELETED;
            // T3: E2E image markers render as the image (+ optional caption).
            const image = !deleted ? parseImageMarker(m.content) : null;
            if (image) {
              return (
                <div key={m.id ?? i} className={cn("group flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                  {!mine && <div className="w-7 shrink-0"><Avatar name={peerName || peerId} id={peerId} className="!size-7 !text-[11px]" /></div>}
                  <div className={cn("flex max-w-[68%] flex-col", mine ? "items-end" : "items-start")}>
                    <button
                      onClick={() => useLightbox.getState().open({ src: image.dataUrl, alt: image.caption || "Shared image (E2E)" })}
                      className="cursor-zoom-in"
                    >
                      <img src={image.dataUrl} alt="Shared image" className="max-h-72 rounded-card border border-line object-contain" />
                    </button>
                    {image.caption && (
                      <div
                        className={cn(
                          "mt-1 rounded-card px-3 py-1.5 text-[14px] leading-relaxed",
                          mine ? "rounded-tr-md bg-ink text-paper" : "rounded-tl-md bg-field text-ink",
                        )}
                      >
                        <MessageBody text={image.caption} />
                      </div>
                    )}
                    <span className="mt-0.5 text-[10px] text-ink-faint">{formatTime(new Date(m.timestamp))} · E2E</span>
                  </div>
                </div>
              );
            }
            // T3: call markers render as event chips, never as chat bubbles.
            const signal = !deleted ? parseCallSignal(m.content) : null;
            if (signal) {
              return (
                <div key={m.id ?? i} className="flex justify-center py-1">
                  <span className="inline-flex items-center gap-1.5 rounded-control bg-field px-2.5 py-1 text-[12px] text-ink-mute">
                    <Phone className="size-3" />
                    {callSignalLabel(signal, mine, peerName || truncateHandle(peerId, 8, 4))}
                    <span className="text-ink-faint">· {formatTime(new Date(m.timestamp))}</span>
                  </span>
                </div>
              );
            }
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
                  <Tooltip label="Edit message">
                    <button
                      onClick={() => setEditingId(m.id!)}
                      aria-label="Edit message"
                      className="grid size-7 place-items-center rounded-[calc(var(--radius-control)-2px)] text-ink-mute transition-colors hover:bg-field hover:text-ink"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </Tooltip>
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
                <div className={cn("flex max-w-[68%] min-w-0 flex-col", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "relative px-3.5 py-2 text-[14px] leading-relaxed",
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
                  {/* E2E: previews are YouTube-only and never touch the relay. */}
                  {!deleted && <MessagePreviews text={m.content} e2e />}
                </div>
                {!mine && actions}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        {attachNotice && (
          <div className="px-4">
            <StackToast tone="info" message={attachNotice} onDismiss={() => setAttachNotice(null)} />
          </div>
        )}
        <Composer
          placeholder={isSelf ? "Message yourself, encrypted for real…" : `Message ${peerName || "contact"} (E2E)…`}
          e2e
          busy={sending}
          onSend={(text) => void send(text)}
          onAttach={stageImages}
          staged={staged}
          onRemoveStaged={(i) => setStaged((s) => s.filter((_, idx) => idx !== i))}
          mentionCandidates={mentionCandidates}
        />
      </div>
    </div>
  );
}
