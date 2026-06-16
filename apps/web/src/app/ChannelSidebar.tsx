import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  Hash,
  Lock,
  ChevronDown,
  Plus,
  Sparkles,
  MessagesSquare,
  Users,
  Search,
  BellOff,
  ShieldCheck,
} from "lucide-react";
import { Avatar, Badge } from "@gossip/ui";
import { channels } from "@/data/mock";
import { cn, truncateHandle } from "@/lib/utils";
import { useContacts } from "@/stores/useContacts";
import { useSession } from "@/stores/useSession";
import { NewDmDialog } from "@/components/chat/NewDmDialog";

function Row({
  to,
  active,
  children,
  unread,
  mentions,
  muted,
}: {
  to: string;
  active?: boolean;
  children: React.ReactNode;
  unread?: number;
  mentions?: number;
  muted?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[14px] transition-colors",
          (isActive || active)
            ? "bg-[color:var(--accent-faint)] text-text font-medium"
            : unread
              ? "text-text hover:bg-surface-raised"
              : "text-muted hover:bg-surface-raised hover:text-text",
          muted && "opacity-55",
        )
      }
    >
      {children}
      {mentions ? (
        <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
          {mentions}
        </span>
      ) : unread ? (
        <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-slate px-1 text-[11px] font-semibold text-text">
          {unread}
        </span>
      ) : null}
    </NavLink>
  );
}

function GroupLabel({
  label,
  open,
  onToggle,
  onAdd,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 pb-1 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint hover:text-muted"
      >
        <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} />
        {label}
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          className="ml-auto grid size-5 place-items-center rounded text-faint hover:bg-surface-raised hover:text-text"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function ChannelSidebar() {
  const { workspaceId = "w_gossip", channelId, dmId } = useParams();
  const base = `/w/${workspaceId}`;
  const [showCh, setShowCh] = useState(true);
  const [showDm, setShowDm] = useState(true);
  const [newDm, setNewDm] = useState(false);
  const sessionStatus = useSession((s) => s.status);
  const contacts = useContacts((s) => s.contacts);
  const refreshContacts = useContacts((s) => s.refresh);

  useEffect(() => {
    if (sessionStatus !== "open") return;
    refreshContacts();
    const unsub = useContacts.getState().subscribe();
    return unsub;
  }, [sessionStatus, refreshContacts]);

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Workspace header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <button className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-raised">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display text-[15px] font-bold text-text">
              <span className="truncate">Gossip Labs</span>
              <ChevronDown className="size-4 shrink-0 text-muted" />
            </div>
          </div>
        </button>
        <Badge tone="accent" className="shrink-0" dot>
          E2E
        </Badge>
      </div>

      {/* Quick nav */}
      <div className="space-y-0.5 px-2 pt-2">
        <Row to={`${base}/search`}>
          <Search className="size-4 text-faint" /> Search
        </Row>
        <Row to={`${base}/threads`}>
          <MessagesSquare className="size-4 text-faint" /> Threads
        </Row>
        <Row to={`${base}/ai`}>
          <span className="grid size-4 place-items-center">
            <Sparkles className="size-4 text-accent" />
          </span>
          <span>OpenClaw AI</span>
          <Badge tone="accent" className="ml-auto py-0">
            local
          </Badge>
        </Row>
        <Row to={`${base}/members`}>
          <Users className="size-4 text-faint" /> Members
        </Row>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-2 pb-4">
        {/* Channels */}
        <GroupLabel label="Channels" open={showCh} onToggle={() => setShowCh((v) => !v)} onAdd={() => {}} />
        {showCh &&
          channels.map((c) => (
            <Row
              key={c.id}
              to={`${base}/c/${c.id}`}
              active={c.id === channelId}
              unread={c.unread}
              mentions={c.mentions}
              muted={c.muted}
            >
              {c.type === "private" ? (
                <Lock className="size-4 shrink-0 text-faint" />
              ) : (
                <Hash className="size-4 shrink-0 text-faint" />
              )}
              <span className="truncate">{c.name}</span>
              {c.aiMember && <Sparkles className="size-3 shrink-0 text-accent/70" />}
              {c.muted && <BellOff className="size-3 shrink-0 text-faint" />}
            </Row>
          ))}

        {/* Direct messages */}
        <GroupLabel label="Direct messages" open={showDm} onToggle={() => setShowDm((v) => !v)} onAdd={() => setNewDm(true)} />
        {showDm && (
          <Row to={`${base}/dm/dm_self`} active={dmId === "dm_self"}>
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
              <ShieldCheck className="size-3" />
            </span>
            <span className="min-w-0 flex-1 truncate">Notes to Self</span>
            <Badge tone="accent" className="ml-auto py-0">live</Badge>
          </Row>
        )}
        {showDm &&
          contacts.map((c) => (
            <Row key={c.userId} to={`${base}/dm/${encodeURIComponent(c.userId)}`} active={dmId === c.userId}>
              <Avatar name={c.name} id={c.userId} size={20} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <ShieldCheck className="size-3 shrink-0 text-accent/60" />
            </Row>
          ))}
        {showDm && contacts.length === 0 && (
          <button
            onClick={() => setNewDm(true)}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-[13px] text-faint hover:bg-surface-raised hover:text-text"
          >
            <Plus className="size-4" /> New message
          </button>
        )}

        <div className="mt-2 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-faint">
          {sessionStatus === "open"
            ? truncateHandle(useSession.getState().userId ?? "", 12, 6)
            : "session locked"}
        </div>
      </div>

      {newDm && <NewDmDialog onClose={() => setNewDm(false)} />}
    </aside>
  );
}
