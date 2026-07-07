import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Hash, Lock, Phone, Sparkles, Users, ShieldAlert, Circle } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { AiSidePanel } from "@/components/chat/AiSidePanel";
import { Avatar } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { formatTime } from "@/lib/utils";
import { useStartDm } from "@/lib/useStartDm";

export function ChannelView() {
  const { workspaceId = "", channelId = "" } = useParams();
  const [aiOpen, setAiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const workspace = useRelay((s) => s.workspace);
  const channel = workspace?.channels.find((c) => c.id === channelId);
  const conn = useRelay((s) => s.conn);
  const messages = useRelay((s) => s.messagesByChannel[channelId]) ?? [];
  const presence = useRelay((s) => s.presenceByChannel[channelId]) ?? 0;
  const myId = useSession((s) => s.userId);
  const startDm = useStartDm();

  useEffect(() => {
    if (workspaceId && channelId) useRelay.getState().joinChannel(workspaceId, channelId);
  }, [workspaceId, channelId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const name = channel?.name ?? "channel";
  const isPrivate = channel?.type === "private";

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
              <Link to={`/w/${workspaceId}/members`}>
                <HeaderIconButton label="Members"><Users className="size-4" /></HeaderIconButton>
              </Link>
              <HeaderIconButton label="Ask OpenClaw" active={aiOpen} onClick={() => setAiOpen((v) => !v)}>
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
              <ShieldAlert className="size-3.5" /> Group messages are relay-backed and workspace-confidential — not E2E yet.
            </div>
          </div>

          {messages.length === 0 && <p className="px-5 py-8 text-[13px] text-ink-faint">No messages yet — say hello to the channel.</p>}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showAuthor = !prev || prev.senderId !== m.senderId || m.ts - prev.ts > 5 * 60 * 1000;
            const mine = m.senderId === myId;
            return (
              <div key={m.id} className={`group flex gap-3 px-5 ${showAuthor ? "mt-3 pt-1" : "py-0.5"} hover:bg-paper-2`}>
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
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{m.body}</div>
                </div>
              </div>
            );
          })}
          <div className="h-4" />
        </div>

        <Composer placeholder={`Message #${name}`} onSend={(text) => useRelay.getState().post(workspaceId, channelId, text)} />
      </div>

      {aiOpen && <AiSidePanel workspaceId={workspaceId} channelId={channelId} channelName={name} onClose={() => setAiOpen(false)} />}
    </div>
  );
}
