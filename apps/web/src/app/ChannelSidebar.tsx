import { useState } from "react";
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
  Copy,
  Check,
  Phone,
} from "lucide-react";
import { NavBadge, Tooltip } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";
import { inviteLink } from "@/lib/invite";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";
import { useNotifications } from "@/stores/useNotifications";
import { CreateChannelDialog } from "@/components/chat/CreateChannelDialog";
import { ChannelMembersDialog } from "@/components/chat/ChannelMembersDialog";
import { ContextMenu, ConfirmDialog } from "@/components/ContextMenu";
import { CallSidebarPanel } from "@/components/CallDock";
import { useUnlockPrompt } from "@/components/UnlockDialog";
import type { RelayChannel } from "@/stores/useRelay";
import { Trash2, Users as UsersIcon } from "lucide-react";

/** NavLink styled like the Stack kit's NavItem (kept as a real link for router semantics). */
export function Row({
  to,
  active,
  end,
  children,
}: {
  to: string;
  active?: boolean;
  end?: boolean;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-[13px] transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
          isActive || active
            ? "bg-field font-medium text-ink"
            : "text-ink-mute hover:bg-field/60 hover:text-ink",
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function GroupLabel({
  label,
  open,
  onToggle,
  onAdd,
  addLabel,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  /** Tooltip + accessible name for the "+" action, e.g. "Create a channel". */
  addLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1 px-2 pb-1 pt-3">
      <button onClick={onToggle} className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint hover:text-ink-mute">
        <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} />
        {label}
      </button>
      {onAdd && (
        <Tooltip label={addLabel ?? "Add"} className="ml-auto">
          <button
            onClick={onAdd}
            aria-label={addLabel ?? "Add"}
            className="grid size-5 place-items-center rounded text-ink-faint hover:bg-field hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** Green pulsing phone on channels with a live huddle (T3). */
function ChannelCallBadge({ channelId }: { channelId: string }) {
  const call = useRelay((s) => s.activeCallByChannel[channelId]);
  if (!call) return null;
  return (
    <span
      title={`Huddle in progress · ${call.count} ${call.count === 1 ? "person" : "people"}`}
      className="relative grid size-4 shrink-0 place-items-center text-positive"
    >
      <Phone className="size-3.5" />
      <span className="absolute -right-0.5 -top-0.5 size-1.5 animate-ping rounded-full bg-positive opacity-75" />
    </span>
  );
}

/** Unread count pill for a sidebar row (T2-09). */
export function ChannelUnreadBadge({ channelId }: { channelId: string }) {
  const count = useNotifications((s) => s.unreadByChannel[channelId] ?? 0);
  if (!count) return null;
  return (
    <span className="grid min-w-4 shrink-0 place-items-center rounded-full bg-ink px-1 text-[9.5px] font-bold leading-4 text-paper">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ChannelSidebar() {
  const { workspaceId = "", channelId } = useParams();
  const base = `/w/${workspaceId}`;
  const [showCh, setShowCh] = useState(true);
  const [newChannel, setNewChannel] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const workspace = useRelay((s) => s.workspace);
  const channels = workspace?.id === workspaceId ? workspace.channels : [];
  const sessionStatus = useSession((s) => s.status);

  // Right-click channel management (T3) - admins/owner only.
  const myId = useSession((s) => s.userId);
  const myRole = workspace?.members.find((x) => x.userId === myId)?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";
  const [chMenu, setChMenu] = useState<{ x: number; y: number; channel: RelayChannel } | null>(null);
  const [chDelete, setChDelete] = useState<RelayChannel | null>(null);
  const [chMembers, setChMembers] = useState<RelayChannel | null>(null);

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-line bg-paper-2 font-stack max-md:w-auto max-md:min-w-0 max-md:flex-1">
      {/* Workspace header */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            <span className="truncate">{workspace?.name ?? "Workspace"}</span>
          </div>
          {workspace?.code && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(inviteLink(workspace.code));
                setCopiedCode(true);
                setTimeout(() => setCopiedCode(false), 1500);
              }}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-ink-faint hover:text-ink"
              title="Copy invite link"
            >
              {copiedCode ? "link copied!" : `invite: ${workspace.code}`}
              {copiedCode ? <Check className="size-3 text-positive" /> : <Copy className="size-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="space-y-0.5 px-2 pt-2">
        <Row to={`${base}/ai`}>
          <Sparkles className="size-4 shrink-0" />
          <span>Gossip AI</span>
          <NavBadge>local</NavBadge>
        </Row>
        <Row to={`${base}/members`}>
          <Users className="size-4 shrink-0" /> Members
        </Row>
        <Row to={`${base}/threads`}>
          <MessagesSquare className="size-4 shrink-0" /> Threads
        </Row>
        <Row to={`${base}/search`}>
          <Search className="size-4 shrink-0" /> Search
        </Row>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-2 pb-4">
        {/* Channels */}
        <GroupLabel label="Channels" open={showCh} onToggle={() => setShowCh((v) => !v)} onAdd={() => setNewChannel(true)} addLabel="Create a channel" />
        {showCh &&
          channels.map((c) => (
            <div
              key={c.id}
              onContextMenu={
                isAdmin
                  ? (e) => {
                      e.preventDefault();
                      setChMenu({ x: e.clientX, y: e.clientY, channel: c });
                    }
                  : undefined
              }
            >
              <Row to={`${base}/c/${c.id}`} active={c.id === channelId}>
                {c.type === "private" ? <Lock className="size-4 shrink-0" /> : <Hash className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <ChannelCallBadge channelId={c.id} />
                <ChannelUnreadBadge channelId={c.id} />
              </Row>
            </div>
          ))}
        {showCh && channels.length === 0 && (
          <button onClick={() => setNewChannel(true)} className="mt-1 flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-[13px] text-ink-faint hover:bg-field hover:text-ink">
            <Plus className="size-4" /> Create a channel
          </button>
        )}

        <div className="mt-2 px-2.5 py-2 text-[11px] leading-relaxed text-ink-faint">
          {sessionStatus === "open" ? (
            <span className="inline-flex items-center gap-1.5" title="Session unlocked - your full handle is in Settings → Profile">
              <span className="size-1.5 rounded-full bg-positive" />
              {useSession.getState().displayName || "unlocked"}
            </span>
          ) : (
            <button onClick={() => useUnlockPrompt.getState().show()} className="underline underline-offset-2 hover:text-ink">
              session locked - unlock
            </button>
          )}
        </div>
      </div>

      {/* Live call panel - pinned to the sidebar bottom while in a call, Discord-style. */}
      <CallSidebarPanel />

      {chMenu && (
        <ContextMenu
          x={chMenu.x}
          y={chMenu.y}
          header={`#${chMenu.channel.name}`}
          onClose={() => setChMenu(null)}
          items={[
            ...(chMenu.channel.type === "public"
              ? [
                  {
                    label: "Make private",
                    icon: <Lock className="size-4" />,
                    onClick: () => {
                      const ch = chMenu.channel;
                      void useRelay.getState().makeChannelPrivate(workspaceId, ch.id);
                    },
                  },
                ]
              : [
                  {
                    label: "Manage members / invite",
                    icon: <UsersIcon className="size-4" />,
                    onClick: () => setChMembers(chMenu.channel),
                  },
                ]),
            {
              label: "Delete channel",
              icon: <Trash2 className="size-4" />,
              danger: true,
              onClick: () => setChDelete(chMenu.channel),
            },
          ]}
        />
      )}
      {chDelete && (
        <ConfirmDialog
          title={`Delete #${chDelete.name}?`}
          body="This permanently deletes the channel and its full message history for everyone. There is no undo."
          confirmLabel="Delete channel"
          onConfirm={async () => {
            const res = await useRelay.getState().deleteChannel(workspaceId, chDelete.id);
            return res.ok ? null : res.error;
          }}
          onClose={() => setChDelete(null)}
        />
      )}
      {chMembers && (
        <ChannelMembersDialog workspaceId={workspaceId} channel={chMembers} onClose={() => setChMembers(null)} />
      )}

      {newChannel && workspaceId && <CreateChannelDialog workspaceId={workspaceId} onClose={() => setNewChannel(false)} />}
    </aside>
  );
}
