import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Hash, Lock, Phone, Sparkles, Users, Info, Pin, ShieldAlert, Circle } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { AiSidePanel } from "@/components/chat/AiSidePanel";
import { Avatar, Badge } from "@gossip/ui";
import { channelById } from "@/data/mock";
import { useGroupChat } from "@/stores/useGroupChat";
import { useSession } from "@/stores/useSession";
import { formatTime } from "@/lib/utils";

export function ChannelView() {
  const { workspaceId = "w_gossip", channelId = "c_design" } = useParams();
  const channel = channelById(channelId);
  const [aiOpen, setAiOpen] = useState(channelId === "c_design");
  const scrollRef = useRef<HTMLDivElement>(null);

  const join = useGroupChat((s) => s.join);
  const post = useGroupChat((s) => s.post);
  const conn = useGroupChat((s) => s.conn);
  const messages = useGroupChat((s) => s.messagesByChannel[channelId]) ?? [];
  const presence = useGroupChat((s) => s.presenceByChannel[channelId]) ?? 0;
  const myId = useSession((s) => s.userId);

  useEffect(() => {
    join(channelId);
  }, [channelId, join]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <PaneHeader
          icon={channel.type === "private" ? <Lock className="size-[18px] text-faint" /> : <Hash className="size-[18px] text-faint" />}
          title={channel.name}
          subtitle={channel.topic}
          badge={
            <span title="Channel messages are workspace-confidential (TLS via the relay), not E2E in v1.">
              <Badge tone="warning" className="ml-1">
                <ShieldAlert className="size-3" /> confidential
              </Badge>
            </span>
          }
          actions={
            <>
              <span className="mr-1 hidden items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[12px] text-muted md:inline-flex">
                <Circle className={conn === "open" ? "size-2 fill-[color:var(--accent)] text-[color:var(--accent)]" : "size-2 fill-[color:var(--text-faint)] text-[color:var(--text-faint)]"} />
                {presence} online
              </span>
              <Link to={`/w/${workspaceId}/call/${channelId}`}>
                <HeaderIconButton label="Start huddle"><Phone className="size-4" /></HeaderIconButton>
              </Link>
              <HeaderIconButton label="Pin"><Pin className="size-4" /></HeaderIconButton>
              <HeaderIconButton label="Members"><Users className="size-4" /></HeaderIconButton>
              <HeaderIconButton label="Ask OpenClaw" active={aiOpen} onClick={() => setAiOpen((v) => !v)}>
                <Sparkles className="size-4" />
              </HeaderIconButton>
              <HeaderIconButton label="Details"><Info className="size-4" /></HeaderIconButton>
            </>
          }
        />

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {/* Channel intro */}
          <div className="px-5 pb-2 pt-8">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-raised">
              {channel.type === "private" ? <Lock className="size-6 text-accent" /> : <Hash className="size-6 text-accent" />}
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold text-text">
              {channel.type === "private" ? "" : "#"}
              {channel.name}
            </h2>
            <p className="mt-1 max-w-xl text-[14px] text-muted">This is the start of #{channel.name}. {channel.topic}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--accent-faint)] px-2.5 py-1.5 text-[13px] text-text">
              <ShieldAlert className="size-3.5 text-warning" /> Group messages are relay-backed and workspace-confidential — not E2E yet.
            </div>
          </div>

          {messages.length === 0 && (
            <p className="px-5 py-8 text-[13px] text-faint">No messages yet — say hello to the channel.</p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showAuthor = !prev || prev.senderId !== m.senderId || m.ts - prev.ts > 5 * 60 * 1000;
            const mine = m.senderId === myId;
            return (
              <div key={m.id} className={`group flex gap-3 px-5 ${showAuthor ? "mt-3 pt-1" : "py-0.5"} hover:bg-surface/60`}>
                <div className="w-9 shrink-0">
                  {showAuthor && <Avatar name={m.senderName} id={m.senderId} size={36} />}
                </div>
                <div className="min-w-0 flex-1">
                  {showAuthor && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text">{m.senderName}</span>
                      {mine && <span className="text-[11px] text-faint">you</span>}
                      <span className="text-[11px] text-faint">{formatTime(new Date(m.ts))}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-text/90">{m.body}</div>
                </div>
              </div>
            );
          })}
          <div className="h-4" />
        </div>

        <Composer placeholder={`Message #${channel.name}`} onSend={(text) => post(channelId, text)} />
      </div>

      {aiOpen && <AiSidePanel channelName={channel.name} onClose={() => setAiOpen(false)} />}
    </div>
  );
}
