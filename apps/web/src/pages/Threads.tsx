import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Hash, MessagesSquare, MessageSquareReply } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { PaneEmptyState } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { formatTime } from "@/lib/utils";

export function Threads() {
  const { workspaceId = "" } = useParams();
  const workspace = useRelay((s) => s.workspace);
  const messagesByChannel = useRelay((s) => s.messagesByChannel);
  const myId = useSession((s) => s.userId);

  // Threads from loaded channel histories where I participated (root author or replier),
  // newest activity first.
  const threads = useMemo(() => {
    const all = Object.values(messagesByChannel).flat().filter((m) => m.workspaceId === workspaceId);
    const byId = new Map(all.map((m) => [m.id, m]));
    const grouped = new Map<string, typeof all>();
    for (const m of all) {
      if (!m.threadRootId) continue;
      const arr = grouped.get(m.threadRootId) ?? [];
      arr.push(m);
      grouped.set(m.threadRootId, arr);
    }
    const channelName = (id: string) => workspace?.channels.find((c) => c.id === id)?.name ?? id;
    return [...grouped.entries()]
      .map(([rootId, replies]) => {
        const root = byId.get(rootId);
        if (!root) return null;
        const participated = root.senderId === myId || replies.some((r) => r.senderId === myId);
        if (!participated) return null;
        const last = replies.reduce((a, b) => (a.ts > b.ts ? a : b));
        return { root, replies, last, channelName: channelName(root.channelId) };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.last.ts - a.last.ts);
  }, [messagesByChannel, workspaceId, workspace, myId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader title="Threads" subtitle="Conversations you're part of" />
      {threads.length === 0 ? (
        <PaneEmptyState
          icon={<MessagesSquare />}
          title="No threads yet"
          description="Reply to a channel message to start a thread. Threads you take part in show up here."
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
            {threads.map((t) => (
              <Link
                key={t.root.id}
                to={`/w/${workspaceId}/c/${t.root.channelId}?thread=${t.root.id}`}
                className="block rounded-card border border-line bg-paper p-4 transition-colors hover:border-line-strong hover:bg-paper-2"
              >
                <div className="mb-2 flex items-center gap-1.5 text-[13px] text-ink-mute">
                  <Hash className="size-3.5" /> {t.channelName}
                </div>
                <div className="flex items-start gap-3">
                  <Avatar name={t.root.senderName} id={t.root.senderId} className="!size-8 !text-[12px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-ink">{t.root.senderName}</span>
                      <span className="text-[11px] text-ink-faint">{formatTime(new Date(t.root.ts))}</span>
                    </div>
                    <p className="truncate text-[14px] text-ink-mute">{t.root.body}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-mute">
                      <MessageSquareReply className="size-3.5" />
                      {t.replies.length} {t.replies.length === 1 ? "reply" : "replies"}
                      <span className="font-normal text-ink-faint">· last {formatTime(new Date(t.last.ts))} by {t.last.senderName}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
