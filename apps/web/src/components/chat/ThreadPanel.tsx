import { useEffect, useMemo, useRef, useState } from "react";
import { X, MessagesSquare, SendHorizontal } from "lucide-react";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { MessageBody } from "@/components/chat/MessageBody";
import { MessagePreviews } from "@/components/chat/LinkPreview";
import { isBareImageUrl } from "@/lib/media";
import { AttachmentView } from "@/components/chat/AttachmentView";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { cn, formatTime } from "@/lib/utils";

function Row({
  senderId,
  senderName,
  ts,
  body,
  mine,
  deleted,
  editedAt,
  attachment,
}: {
  senderId: string;
  senderName: string;
  ts: number;
  body: string;
  mine: boolean;
  deleted?: boolean;
  editedAt?: number | null;
  attachment?: import("@/lib/uploads").AttachmentRef | null;
}) {
  return (
    <div className="flex gap-2.5">
      <Avatar name={senderName} id={senderId} className="!size-7 !text-[11px] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{senderName}</span>
          {mine && <span className="text-[11px] text-ink-faint">you</span>}
          <span className="text-[11px] text-ink-faint">{formatTime(new Date(ts))}</span>
        </div>
        {deleted ? (
          <div className="text-[13px] italic text-ink-faint">message deleted</div>
        ) : (
          <div className="text-[13.5px] leading-relaxed text-ink">
            {body && !isBareImageUrl(body) && <MessageBody text={body} />}
            {editedAt != null && <span className="ml-1.5 text-[11px] text-ink-faint">(edited)</span>}
            {attachment && <AttachmentView a={attachment} />}
            {body && <MessagePreviews text={body} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Right-hand thread pane: root message, its replies, and a reply composer. */
export function ThreadPanel({
  workspaceId,
  channelId,
  rootId,
  onClose,
}: {
  workspaceId: string;
  channelId: string;
  rootId: string;
  onClose: () => void;
}) {
  const messages = useRelay((s) => s.messagesByChannel[channelId]) ?? [];
  const myId = useSession((s) => s.userId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const root = useMemo(() => messages.find((m) => m.id === rootId), [messages, rootId]);
  const replies = useMemo(
    () => messages.filter((m) => m.threadRootId === rootId).sort((a, b) => a.ts - b.ts),
    [messages, rootId],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [replies.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    useRelay.getState().post(workspaceId, channelId, text, rootId);
    setDraft("");
  };

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-line bg-paper-2 font-stack max-md:absolute max-md:inset-0 max-md:z-20 max-md:w-auto max-md:border-l-0">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
        <MessagesSquare className="size-4 text-ink-mute" />
        <div className="text-[14px] font-semibold text-ink">Thread</div>
        <span className="text-[12px] text-ink-faint">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </span>
        <button onClick={onClose} aria-label="Close thread" className="ml-auto grid size-8 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink">
          <X className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {root ? (
          <>
            <Row senderId={root.senderId} senderName={root.senderName} ts={root.ts} body={root.body} mine={root.senderId === myId} deleted={root.deleted} editedAt={root.editedAt} attachment={root.attachment} />
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-line" />
              <span className="text-[11px] text-ink-faint">
                {replies.length === 0 ? "no replies yet" : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>
            {replies.map((r) => (
              <Row key={r.id} senderId={r.senderId} senderName={r.senderName} ts={r.ts} body={r.body} mine={r.senderId === myId} deleted={r.deleted} editedAt={r.editedAt} attachment={r.attachment} />
            ))}
          </>
        ) : (
          <p className="py-8 text-center text-[13px] text-ink-faint">
            This thread's start isn't in the loaded history anymore.
          </p>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-card border border-line bg-paper px-3 py-2 transition-colors focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[color:var(--st-ring)]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Reply in thread…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || !root}
            aria-label="Send reply"
            className={cn(
              "grid size-7 place-items-center rounded-control transition-colors",
              draft.trim() && root ? "bg-ink text-paper hover:bg-ink-hover" : "bg-field text-ink-faint",
            )}
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
