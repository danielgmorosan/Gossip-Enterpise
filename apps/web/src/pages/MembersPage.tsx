import { useState } from "react";
import { Search, UserPlus, Check, MessageSquare } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { Avatar, Button, Input } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { truncateHandle } from "@/lib/utils";
import { useStartDm } from "@/lib/useStartDm";
import { inviteLink } from "@/lib/invite";

export function MembersPage() {
  const workspace = useRelay((s) => s.workspace);
  const myId = useSession((s) => s.userId);
  const startDm = useStartDm();
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const members = (workspace?.members ?? []).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        title="Members"
        subtitle={`${workspace?.members.length ?? 0} in ${workspace?.name ?? "this workspace"}`}
        actions={
          workspace?.code ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(inviteLink(workspace.code));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <UserPlus className="size-4" />}
              {copied ? "Link copied" : "Copy invite link"}
            </Button>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <Input className="h-10 pl-10 text-[14px]" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="overflow-hidden rounded-card border border-line">
            {members.map((m, i) => (
              <button
                key={m.userId}
                onClick={() => startDm(m.userId, m.name)}
                className="group flex w-full items-center gap-3 border-line bg-paper px-4 py-3 text-left transition-colors hover:bg-paper-2"
                style={{ borderTopWidth: i ? 1 : 0 }}
              >
                <Avatar name={m.name} id={m.userId} className="!size-9 !text-[13px]" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-ink">{m.name}</span>
                    {m.userId === myId && <span className="text-[12px] text-ink-faint">· you</span>}
                  </div>
                  <div className="font-mono text-[11px] text-ink-faint">{truncateHandle(m.userId, 16, 6)}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-[12.5px] text-ink-mute opacity-0 transition-opacity group-hover:opacity-100">
                    <MessageSquare className="size-3.5" /> {m.userId === myId ? "Notes" : "Message"}
                  </span>
                  <span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium capitalize text-ink-mute">{m.role}</span>
                </div>
              </button>
            ))}
            {members.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-ink-faint">No members yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
