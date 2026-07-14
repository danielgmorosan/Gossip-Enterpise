import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Hash, Lock, Phone, Sparkles, Users, ShieldAlert, Circle, MessageSquareReply, Pencil } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageBody } from "@/components/chat/MessageBody";
import { MessageActionsBar, ArmDeleteButton, EditBox } from "@/components/chat/MessageActionsBar";
import { AttachmentView } from "@/components/chat/AttachmentView";
import { uploadAttachment } from "@/lib/uploads";
import { StackToast, Tooltip } from "@gossip/ui/stack";
import { AiSidePanel } from "@/components/chat/AiSidePanel";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { ChannelMembersDialog } from "@/components/chat/ChannelMembersDialog";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useNotifications } from "@/stores/useNotifications";
import { formatTime } from "@/lib/utils";
import { useStartDm } from "@/lib/useStartDm";

export function ChannelView() {
  const { workspaceId = "", channelId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get("thread");
  const [aiOpen, setAiOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** T-13: upload each picked file to the relay, then post it as a message. */
  const handleAttach = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        setUploadNotice(`Uploading ${file.name}…`);
        const ref = await uploadAttachment(file);
        useRelay.getState().post(workspaceId, channelId, "", undefined, ref.id);
        setUploadNotice(null);
      } catch (e) {
        setUploadNotice(e instanceof Error ? e.message : "Upload failed.");
        setTimeout(() => setUploadNotice(null), 5000);
        return;
      }
    }
  };

  const workspace = useRelay((s) => s.workspace);
  const channel = workspace?.channels.find((c) => c.id === channelId);
  const conn = useRelay((s) => s.conn);
  const messages = useRelay((s) => s.messagesByChannel[channelId]) ?? [];
  const presence = useRelay((s) => s.presenceByChannel[channelId]) ?? 0;
  const myId = useSession((s) => s.userId);
  const myRole = workspace?.members.find((x) => x.userId === myId)?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";
  const startDm = useStartDm();

  // @mention picker candidates (T2-05): everyone in the workspace.
  const mentionCandidates = useMemo(
    () => (workspace?.members ?? []).map((m) => ({ id: m.userId, name: m.name })),
    [workspace?.members],
  );

  // Main feed shows only thread roots / plain messages; replies live in the panel.
  const feed = useMemo(() => messages.filter((m) => !m.threadRootId), [messages]);
  const replyStats = useMemo(() => {
    const map = new Map<string, { count: number; lastTs: number }>();
    for (const m of messages) {
      if (!m.threadRootId) continue;
      const cur = map.get(m.threadRootId) ?? { count: 0, lastTs: 0 };
      map.set(m.threadRootId, { count: cur.count + 1, lastTs: Math.max(cur.lastTs, m.ts) });
    }
    return map;
  }, [messages]);

  const openThread = (rootId: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (rootId) next.set("thread", rootId);
        else next.delete("thread");
        return next;
      },
      { replace: true },
    );
    if (rootId) setAiOpen(false);
  };

  useEffect(() => {
    if (workspaceId && channelId) useRelay.getState().joinChannel(workspaceId, channelId);
  }, [workspaceId, channelId]);

  // T2-09: viewing the channel clears its unread badge (and keeps it clear
  // as messages stream in while it's on screen).
  useEffect(() => {
    if (channelId) useNotifications.getState().clearChannelUnread(channelId);
  }, [channelId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [feed.length]);

  const name = channel?.name ?? "channel";
  const isPrivate = channel?.type === "private";

  // T2-08: private channels you aren't in are filtered out of the workspace
  // snapshot server-side — a stale/shared link lands here with no channel.
  if (workspace && workspace.id === workspaceId && !channel) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink">
            <Lock className="size-6" />
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">Channel unavailable</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-mute">
            This channel doesn't exist, or it's private and you haven't been invited. Ask a channel
            member to add you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader
          icon={isPrivate ? <Lock className="size-4 text-ink-faint" /> : <Hash className="size-4 text-ink-faint" />}
          title={name}
          subtitle={channel?.topic || undefined}
          badge={
            <span
              title="Channel messages are workspace-confidential (TLS via the relay), not E2E in v1."
              className="ml-1 inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink-mute"
            >
              <ShieldAlert className="size-3" /> confidential
            </span>
          }
          actions={
            <>
              <span className="mr-1 hidden items-center gap-1.5 rounded-control border border-line px-2 py-1 text-[12px] text-ink-mute md:inline-flex">
                <Circle className={conn === "open" ? "size-2 fill-[color:var(--st-positive)] text-[color:var(--st-positive)]" : "size-2 fill-[color:var(--st-ink-faint)] text-[color:var(--st-ink-faint)]"} />
                {presence} online
              </span>
              <Link to={`/w/${workspaceId}/call/${channelId}`}>
                <HeaderIconButton label="Start huddle"><Phone className="size-4" /></HeaderIconButton>
              </Link>
              {isPrivate ? (
                <HeaderIconButton label={`Channel members (${channel?.members?.length ?? 0})`} active={membersOpen} onClick={() => setMembersOpen(true)}>
                  <Users className="size-4" />
                </HeaderIconButton>
              ) : (
                <Link to={`/w/${workspaceId}/members`}>
                  <HeaderIconButton label="Members"><Users className="size-4" /></HeaderIconButton>
                </Link>
              )}
              <HeaderIconButton label="Ask Gossip AI" active={aiOpen} onClick={() => { setAiOpen((v) => !v); if (!aiOpen) openThread(null); }}>
                <Sparkles className="size-4" />
              </HeaderIconButton>
            </>
          }
        />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-5 pb-2 pt-8">
            <div className="grid size-12 place-items-center rounded-card bg-field">
              {isPrivate ? <Lock className="size-6 text-ink" /> : <Hash className="size-6 text-ink" />}
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">
              {isPrivate ? "" : "#"}
              {name}
            </h2>
            <p className="mt-1 max-w-xl text-[14px] text-ink-mute">This is the start of #{name}. {channel?.topic}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-field px-2.5 py-1.5 text-[13px] text-ink-mute">
              <ShieldAlert className="size-3.5" />
              {isPrivate
                ? "Invite-only private channel (relay-enforced). Messages are workspace-confidential, not E2E yet."
                : "Group messages are relay-backed and workspace-confidential, not E2E yet."}
            </div>
          </div>

          {feed.length === 0 && <p className="px-5 py-8 text-[13px] text-ink-faint">No messages yet. Say hello to the channel.</p>}
          {feed.map((m, i) => {
            const prev = feed[i - 1];
            const showAuthor = !prev || prev.senderId !== m.senderId || m.ts - prev.ts > 5 * 60 * 1000;
            const mine = m.senderId === myId;
            const stats = replyStats.get(m.id);
            return (
              <div key={m.id} className={`group relative flex gap-3 px-5 ${showAuthor ? "mt-3 pt-1" : "py-0.5"} hover:bg-paper-2`}>
                <div className="w-9 shrink-0">
                  {showAuthor && (
                    <button
                      onClick={() => startDm(m.senderId, m.senderName)}
                      title={mine ? "Your notes" : `Message ${m.senderName}`}
                      className="transition-transform hover:scale-105"
                    >
                      <Avatar name={m.senderName} id={m.senderId} className="!size-9 !text-[13px]" />
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {showAuthor && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startDm(m.senderId, m.senderName)}
                        className="text-[14px] font-semibold text-ink hover:underline"
                        title={mine ? "Your notes" : `Message ${m.senderName}`}
                      >
                        {m.senderName}
                      </button>
                      {mine && <span className="text-[11px] text-ink-faint">you</span>}
                      <span className="text-[11px] text-ink-faint">{formatTime(new Date(m.ts))}</span>
                    </div>
                  )}
                  {m.deleted ? (
                    <div className="text-[13.5px] italic text-ink-faint">message deleted</div>
                  ) : editingId === m.id ? (
                    <EditBox
                      initial={m.body}
                      onSave={(text) => {
                        useRelay.getState().editMessage(workspaceId, channelId, m.id, text);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="text-[14px] leading-relaxed text-ink">
                      {m.body && <MessageBody text={m.body} />}
                      {m.editedAt != null && <span className="ml-1.5 text-[11px] text-ink-faint">(edited)</span>}
                      {m.attachment && <AttachmentView a={m.attachment} />}
                    </div>
                  )}
                  {stats && (
                    <button
                      onClick={() => openThread(m.id)}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-control px-1.5 py-0.5 text-[12.5px] font-medium text-ink-mute transition-colors hover:bg-field hover:text-ink"
                    >
                      <MessageSquareReply className="size-3.5" />
                      {stats.count} {stats.count === 1 ? "reply" : "replies"}
                      <span className="font-normal text-ink-faint">· last {formatTime(new Date(stats.lastTs))}</span>
                    </button>
                  )}
                </div>

                {/* Hover actions */}
                {!m.deleted && editingId !== m.id && (
                  <MessageActionsBar
                    copyText={m.body}
                    shareText={`"${m.body}"\n— ${m.senderName} in #${name}\n${window.location.origin}/w/${workspaceId}/c/${channelId}`}
                    className="absolute -top-2.5 right-4 hidden group-hover:flex"
                  >
                    <button
                      onClick={() => openThread(m.id)}
                      title="Reply in thread"
                      aria-label="Reply in thread"
                      className="inline-flex items-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-[12px] text-ink-mute transition-colors hover:bg-field hover:text-ink"
                    >
                      <MessageSquareReply className="size-3.5" /> Reply
                    </button>
                    {mine && (
                      <Tooltip label="Edit message">
                        <button
                          onClick={() => setEditingId(m.id)}
                          aria-label="Edit message"
                          className="grid size-7 place-items-center rounded-[calc(var(--radius-control)-2px)] text-ink-mute transition-colors hover:bg-field hover:text-ink"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    {(mine || isAdmin) && (
                      <ArmDeleteButton onConfirm={() => useRelay.getState().deleteMessage(workspaceId, channelId, m.id)} />
                    )}
                  </MessageActionsBar>
                )}
              </div>
            );
          })}
          <div className="h-4" />
        </div>

        {uploadNotice && (
          <div className="px-4">
            <StackToast tone="info" message={uploadNotice} onDismiss={() => setUploadNotice(null)} />
          </div>
        )}
        <Composer
          placeholder={`Message #${name}`}
          onSend={(text) => useRelay.getState().post(workspaceId, channelId, text)}
          onAttach={(files) => void handleAttach(files)}
          mentionCandidates={mentionCandidates}
        />
      </div>

      {threadId ? (
        <ThreadPanel workspaceId={workspaceId} channelId={channelId} rootId={threadId} onClose={() => openThread(null)} />
      ) : (
        aiOpen && <AiSidePanel workspaceId={workspaceId} channelId={channelId} channelName={name} onClose={() => setAiOpen(false)} />
      )}
      {membersOpen && isPrivate && channel && (
        <ChannelMembersDialog workspaceId={workspaceId} channel={channel} onClose={() => setMembersOpen(false)} />
      )}
    </div>
  );
}
