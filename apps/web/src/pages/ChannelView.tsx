import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, Link, Navigate } from "react-router-dom";
import { Hash, Lock, Phone, Video, Sparkles, Users, ShieldAlert, Circle, MessageSquareReply, Pencil, Reply } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageBody } from "@/components/chat/MessageBody";
import { MessagePreviews } from "@/components/chat/LinkPreview";
import { isBareImageUrl } from "@/lib/media";
import { MessageActionsBar, ArmDeleteButton, EditBox } from "@/components/chat/MessageActionsBar";
import { AttachmentView } from "@/components/chat/AttachmentView";
import { uploadAttachment } from "@/lib/uploads";
import { Button, PasswordInput, StackToast, Tooltip } from "@umbry/ui/stack";
import { AiSidePanel } from "@/components/chat/AiSidePanel";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { ChannelMembersDialog } from "@/components/chat/ChannelMembersDialog";
import { ReactionChips, AddReactionButton } from "@/components/chat/ReactionChips";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay, type RelayChannel, type ChannelMsg } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useUnlockPrompt } from "@/components/UnlockDialog";
import { useFileDrop } from "@/lib/useFileDrop";
import { LiveBars } from "@/components/LiveIndicators";
import { useCall } from "@/stores/useCall";
import { formatTime } from "@/lib/utils";

/** "X is typing…" line above the composer (T3). Entries expire in the store. */
function TypingLine({ channelId }: { channelId: string }) {
  const typing = useRelay((s) => s.typingByChannel[channelId]);
  const names = Object.values(typing ?? {}).map((t) => t.name);
  if (names.length === 0) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : "Several people are typing…";
  return (
    <div className="flex items-center gap-1.5 px-5 pb-1 text-[12px] text-ink-mute">
      <span className="inline-flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-ink-mute [animation-delay:0ms]" />
        <span className="size-1 animate-bounce rounded-full bg-ink-mute [animation-delay:150ms]" />
        <span className="size-1 animate-bounce rounded-full bg-ink-mute [animation-delay:300ms]" />
      </span>
      {label}
    </div>
  );
}

/** The "door" of a password-protected private channel (T3). */
function LockedChannelJoin({ workspaceId, channel }: { workspaceId: string; channel: RelayChannel }) {
  const sessionOpen = useSession((s) => s.status === "open");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionOpen) {
      useUnlockPrompt.getState().show();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await useRelay.getState().joinChannelWithPassword(workspaceId, channel.id, password.trim());
    setBusy(false);
    // Success: the relay's channelUpdated replaces the locked stub and this
    // component unmounts into the real channel view.
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="grid min-h-0 flex-1 place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink">
          <Lock className="size-6" />
        </span>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">{channel.name}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-mute">
          This private channel is password-protected. Enter the password to join.
        </p>
        <form onSubmit={join} className="mt-4 space-y-3 text-left">
          <PasswordInput
            placeholder="Channel password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!error}
          />
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" block disabled={busy || (sessionOpen && !password.trim())}>
            {sessionOpen ? "Join channel" : "Unlock session to join"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function ChannelView({ embedded }: { embedded?: boolean } = {}) {
  const { workspaceId = "", channelId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get("thread");
  const [aiOpen, setAiOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<{ id: string; name: string } | null>(null);
  const [staged, setStaged] = useState<File[]>([]);
  // Quote-reply target (T3): the DEFAULT reply mode; threads are secondary.
  const [replyTo, setReplyTo] = useState<{ id: string; senderName: string; body: string } | null>(null);
  const [composerFocus, setComposerFocus] = useState(0);
  const startReply = (r: { id: string; senderName: string; body: string }) => {
    setReplyTo(r);
    setComposerFocus((n) => n + 1); // jump the cursor into the input
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  // Dropping or picking files only STAGES them in the composer (consent +
  // caption). Nothing touches the relay until the user hits Send.
  const stageFiles = (files: FileList) => setStaged((s) => [...s, ...Array.from(files)]);
  const drop = useFileDrop(stageFiles);

  /** Send text and/or staged files (T-13): the text rides with the first file. */
  const sendMessage = async (text: string) => {
    const files = staged;
    const replyToId = replyTo?.id;
    setStaged([]);
    setReplyTo(null);
    if (files.length === 0) {
      if (text) useRelay.getState().post(workspaceId, channelId, text, undefined, undefined, replyToId);
      return;
    }
    let caption = text;
    let reply = replyToId;
    for (let i = 0; i < files.length; i++) {
      try {
        setUploadNotice(`Uploading ${files[i].name}…`);
        const ref = await uploadAttachment(files[i]);
        useRelay.getState().post(workspaceId, channelId, caption, undefined, ref.id, reply);
        caption = "";
        reply = undefined;
        setUploadNotice(null);
      } catch (e) {
        // Put the unsent files back so nothing is silently lost.
        const remaining = files.slice(i);
        setStaged((cur) => [...remaining, ...cur]);
        setUploadNotice(e instanceof Error ? e.message : "Upload failed.");
        setTimeout(() => setUploadNotice(null), 5000);
        return;
      }
    }
  };

  /** Voice notes send immediately (no staging chip) - upload then post. */
  const sendVoiceNote = async (file: File) => {
    const replyToId = replyTo?.id;
    setReplyTo(null);
    try {
      setUploadNotice("Sending voice message…");
      const ref = await uploadAttachment(file);
      useRelay.getState().post(workspaceId, channelId, "", undefined, ref.id, replyToId);
      setUploadNotice(null);
    } catch (e) {
      setUploadNotice(e instanceof Error ? e.message : "Couldn't send that voice message.");
      setTimeout(() => setUploadNotice(null), 5000);
    }
  };

  const workspace = useRelay((s) => s.workspace);
  const channel = workspace?.channels.find((c) => c.id === channelId);
  const nameOfMember = (id: string) => workspace?.members.find((x) => x.userId === id)?.name ?? `${id.slice(0, 10)}…`;
  const conn = useRelay((s) => s.conn);
  const messages = useRelay((s) => s.messagesByChannel[channelId]) ?? [];
  const viewing = useRelay((s) => s.presenceByChannel[channelId]) ?? 0;
  // "N online" now means workspace members who are actually online (T3), not
  // just people with this channel open. Public channels: all members.
  const onlineUsers = useRelay((s) => s.onlineUsers);
  const onlineCount = useMemo(() => {
    const members = channel?.type === "private" ? channel.members : workspace?.members.map((m) => m.userId);
    return (members ?? []).filter((id) => onlineUsers.has(id)).length;
  }, [channel?.type, channel?.members, workspace?.members, onlineUsers]);
  const activeCall = useRelay((s) => s.activeCallByChannel[channelId]);
  const inThisCall = useCall(
    (s) => s.status !== "idle" && s.target?.kind === "channel" && s.target.channelId === channelId,
  );
  const myId = useSession((s) => s.userId);
  const myRole = workspace?.members.find((x) => x.userId === myId)?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";

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

  const isLockedStub = !!channel?.locked;
  useEffect(() => {
    // Locked stubs (T3) have no readable history - don't subscribe until joined.
    if (workspaceId && channelId && !isLockedStub) useRelay.getState().joinChannel(workspaceId, channelId);
  }, [workspaceId, channelId, isLockedStub]);

  // T2-09/T4: viewing the channel clears its unread badge AND advances the
  // server-side read marker (seen-by + cross-device unread sync) - only while
  // the tab is actually visible.
  useEffect(() => {
    if (!channelId) return;
    const mark = () => {
      if (!document.hidden) useRelay.getState().markChannelRead(workspaceId, channelId);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [workspaceId, channelId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [feed.length]);

  const name = channel?.name ?? "channel";
  const isPrivate = channel?.type === "private";

  // Live call in this channel → the call page IS this channel (full chat
  // under the stage), so keep the call on screen (T3). Skipped when this
  // component is already embedded in the call page itself.
  if (inThisCall && !location.pathname.includes("/call/")) {
    return <Navigate to={`/w/${workspaceId}/call/${channelId}`} replace />;
  }

  // T3: password-protected private channel you're not in - show the door.
  if (channel?.locked) {
    return <LockedChannelJoin workspaceId={workspaceId} channel={channel} />;
  }

  // T2-08: private channels you aren't in are filtered out of the workspace
  // snapshot server-side - a stale/shared link lands here with no channel.
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
    <div className="relative flex min-h-0 flex-1">
      <div className="relative flex min-w-0 flex-1 flex-col" {...drop.props}>
        {drop.dragging && (
          <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-card border-2 border-dashed border-ink bg-paper/85">
            <span className="text-[14px] font-semibold text-ink">Drop to attach - nothing sends until you hit Send</span>
          </div>
        )}
        {/* Inside the call page the stage's header already names the channel -
            skip this one so there's a single banner (T3). */}
        {!embedded && (
        <PaneHeader
          icon={isPrivate ? <Lock className="size-4 text-ink-faint" /> : <Hash className="size-4 text-ink-faint" />}
          title={name}
          subtitle={channel?.topic || undefined}
          badge={
            <span
              title="Channel messages are workspace-confidential (TLS via the relay), not E2EE in v1."
              className="ml-1 inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink-mute max-md:hidden"
            >
              <ShieldAlert className="size-3" /> confidential
            </span>
          }
          actions={
            <>
              <span
                title={viewing > 0 ? `${viewing} viewing this channel now` : undefined}
                className="mr-1 hidden items-center gap-1.5 rounded-control border border-line px-2 py-1 text-[12px] text-ink-mute md:inline-flex"
              >
                <Circle className={conn === "open" ? "size-2 fill-[color:var(--st-positive)] text-[color:var(--st-positive)]" : "size-2 fill-[color:var(--st-ink-faint)] text-[color:var(--st-ink-faint)]"} />
                {onlineCount} online
              </span>
              <Link to={`/w/${workspaceId}/call/${channelId}`}>
                <HeaderIconButton label="Start voice huddle"><Phone className="size-4" /></HeaderIconButton>
              </Link>
              <Link to={`/w/${workspaceId}/call/${channelId}?video=1`}>
                <HeaderIconButton label="Start video huddle"><Video className="size-4" /></HeaderIconButton>
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
              <HeaderIconButton label="Ask Umbry AI" active={aiOpen} onClick={() => { setAiOpen((v) => !v); if (!aiOpen) openThread(null); }}>
                <Sparkles className="size-4" />
              </HeaderIconButton>
            </>
          }
        />
        )}

        {/* Live huddle banner (T3) - Discord-style "call in progress" strip. */}
        {activeCall && !inThisCall && (
          <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-paper-2 px-4 py-2">
            <LiveBars className="h-3.5" />
            <span className="min-w-0 truncate text-[13px] text-ink">
              <span className="font-semibold">Huddle in progress</span>
              <span className="text-ink-mute">
                {" · "}
                {activeCall.count} {activeCall.count === 1 ? "person" : "people"}
                {activeCall.startedByName ? ` · started by ${activeCall.startedByName}` : ""}
              </span>
            </span>
            <Link to={`/w/${workspaceId}/call/${channelId}`} className="ml-auto shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-control bg-positive px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90">
                <Phone className="size-3.5" /> Join
              </span>
            </Link>
          </div>
        )}

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
                ? "Invite-only private channel (relay-enforced). Messages are workspace-confidential, not E2EE yet."
                : "Group messages are relay-backed and workspace-confidential, not E2EE yet."}
            </div>
          </div>

          {feed.length === 0 && <p className="px-5 py-8 text-[13px] text-ink-faint">No messages yet. Say hello to the channel.</p>}
          {feed.map((m, i) => {
            const prev = feed[i - 1];
            const showAuthor = !prev || prev.senderId !== m.senderId || m.ts - prev.ts > 5 * 60 * 1000;
            const mine = m.senderId === myId;
            const stats = replyStats.get(m.id);
            return (
              <div
                key={m.id}
                id={`msg-${m.id}`}
                tabIndex={0}
                className={`group relative flex gap-3 px-5 outline-none ${showAuthor ? "mt-3 pt-1" : "py-0.5"} hover:bg-paper-2 focus-within:bg-paper-2`}
              >
                <div className="w-9 shrink-0">
                  {showAuthor && (
                    <button
                      onClick={() => setProfileUser({ id: m.senderId, name: m.senderName })}
                      title={`View ${mine ? "your" : `${m.senderName}'s`} profile`}
                      className="transition-transform hover:scale-105"
                    >
                      <Avatar name={m.senderName} id={m.senderId} className="!size-9 !text-[13px]" />
                    </button>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Quote-reply reference (T3) - click scrolls to the original. */}
                  {m.replyTo && (
                    <button
                      onClick={() =>
                        document.getElementById(`msg-${m.replyTo!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }
                      className="mb-0.5 flex max-w-full items-center gap-1.5 text-[12px] text-ink-faint hover:text-ink"
                    >
                      <Reply className="size-3 shrink-0 -scale-x-100" />
                      <span className="shrink-0 font-medium text-ink-mute">{m.replyTo.senderName}</span>
                      <span className="min-w-0 truncate">{m.replyTo.body}</span>
                    </button>
                  )}
                  {showAuthor && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setProfileUser({ id: m.senderId, name: m.senderName })}
                        className="text-[14px] font-semibold text-ink hover:underline"
                        title={`View ${mine ? "your" : `${m.senderName}'s`} profile`}
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
                      {/* A message that's just a GIF/image URL renders as only
                          the image (via MessagePreviews) - no raw link text. */}
                      {m.body && !isBareImageUrl(m.body) && <MessageBody text={m.body} />}
                      {m.editedAt != null && <span className="ml-1.5 text-[11px] text-ink-faint">(edited)</span>}
                      {m.attachment && <AttachmentView a={m.attachment} />}
                      {m.body && <MessagePreviews text={m.body} />}
                    </div>
                  )}
                  {!m.deleted && (
                    <ReactionChips
                      reactions={m.reactions}
                      myId={myId}
                      nameOf={nameOfMember}
                      onToggle={(emoji) => useRelay.getState().reactToMessage(workspaceId, channelId, m.id, emoji)}
                    />
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
                    shareText={`"${m.body}"\n- ${m.senderName} in #${name}\n${window.location.origin}/w/${workspaceId}/c/${channelId}`}
                    className="absolute -top-2.5 right-4 hidden group-hover:flex group-focus-within:flex"
                  >
                    <AddReactionButton onPick={(emoji) => useRelay.getState().reactToMessage(workspaceId, channelId, m.id, emoji)} />
                    <button
                      onClick={() => startReply({ id: m.id, senderName: m.senderName, body: m.body || (m.attachment ? `📎 ${m.attachment.name}` : "") })}
                      title="Reply"
                      aria-label="Reply"
                      className="inline-flex items-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-2 py-1 text-[12px] text-ink-mute transition-colors hover:bg-field hover:text-ink"
                    >
                      <Reply className="size-3.5" /> Reply
                    </button>
                    <Tooltip label="Open a thread (side conversation)">
                      <button
                        onClick={() => openThread(m.id)}
                        aria-label="Reply in thread"
                        className="grid size-7 place-items-center rounded-[calc(var(--radius-control)-2px)] text-ink-mute transition-colors hover:bg-field hover:text-ink"
                      >
                        <MessageSquareReply className="size-3.5" />
                      </button>
                    </Tooltip>
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
          <SeenByLine channelId={channelId} feed={feed} myId={myId} nameOf={nameOfMember} />
          <div className="h-4" />
        </div>

        {uploadNotice && (
          <div className="px-4">
            <StackToast tone="info" message={uploadNotice} onDismiss={() => setUploadNotice(null)} />
          </div>
        )}
        <TypingLine channelId={channelId} />
        <Composer
          placeholder={`Message #${name}`}
          onSend={(text) => void sendMessage(text)}
          onTyping={() => useRelay.getState().sendTyping(workspaceId, channelId)}
          onAttach={stageFiles}
          onSendVoice={(file) => void sendVoiceNote(file)}
          staged={staged}
          onRemoveStaged={(i) => setStaged((s) => s.filter((_, idx) => idx !== i))}
          replyingTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          focusSignal={composerFocus}
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
      {profileUser && (
        <UserProfileDialog userId={profileUser.id} name={profileUser.name} onClose={() => setProfileUser(null)} />
      )}
    </div>
  );
}


/**
 * "Seen by" cluster under the newest message (T4): members other than you and
 * the author whose relay read marker has reached it.
 */
function SeenByLine({
  channelId,
  feed,
  myId,
  nameOf,
}: {
  channelId: string;
  feed: ChannelMsg[];
  myId: string | null;
  nameOf: (id: string) => string;
}) {
  const reads = useRelay((s) => s.readsByChannel[channelId]);
  const last = feed[feed.length - 1];
  if (!last || !reads) return null;
  const seen = Object.entries(reads)
    .filter(([uid, r]) => uid !== myId && uid !== last.senderId && r.ts >= last.ts)
    .map(([uid]) => uid);
  if (seen.length === 0) return null;
  const names = seen.map(nameOf);
  const label = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
  return (
    <div className="flex items-center justify-end gap-1.5 px-5 pt-1">
      <div className="flex -space-x-1.5">
        {seen.slice(0, 5).map((uid) => (
          <Avatar key={uid} name={nameOf(uid)} id={uid} className="!size-4 !text-[8px] ring-1 ring-paper" />
        ))}
      </div>
      <span className="text-[11px] text-ink-faint">Seen by {label}</span>
    </div>
  );
}