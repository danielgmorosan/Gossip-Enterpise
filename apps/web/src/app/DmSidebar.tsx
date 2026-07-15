import { useState } from "react";
import { useParams } from "react-router-dom";
import { Users, ShieldCheck, Plus } from "lucide-react";
import { NavBadge } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { truncateHandle } from "@/lib/utils";
import { useSession } from "@/stores/useSession";
import { useContacts, useContactsLive } from "@/stores/useContacts";
import { useNotifications } from "@/stores/useNotifications";
import { NewDmDialog } from "@/components/chat/NewDmDialog";
import { CallSidebarPanel } from "@/components/CallDock";
import { useUnlockPrompt } from "@/components/UnlockDialog";
import { Row, GroupLabel } from "./ChannelSidebar";

/** Unread pill for a DM row (T2-09). */
function DmUnreadBadge({ peerId }: { peerId: string }) {
  const count = useNotifications((s) => s.unreadByDm[peerId] ?? 0);
  if (!count) return null;
  return (
    <span className="grid min-w-4 shrink-0 place-items-center rounded-full bg-ink px-1 text-[9.5px] font-bold leading-4 text-paper">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Sidebar of the personal home space (/home) — Discord-style: DMs live here,
 * outside any workspace. Contacts landing on top, then the conversation list.
 */
export function DmSidebar() {
  const { dmId } = useParams();
  const [showDm, setShowDm] = useState(true);
  const [newDm, setNewDm] = useState(false);

  const sessionStatus = useSession((s) => s.status);
  const contacts = useContacts((s) => s.contacts);
  useContactsLive();

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-line bg-paper-2 font-stack max-md:w-auto max-md:min-w-0 max-md:flex-1">
      {/* Home header */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink">Direct messages</div>
          <div className="mt-0.5 text-[10px] text-ink-faint">personal space, no workspace needed</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
          <span className="size-1.5 rounded-full bg-positive" /> E2E
        </span>
      </div>

      {/* Quick nav */}
      <div className="space-y-0.5 px-2 pt-2">
        {/* ?view=contacts keeps the route at /home but tells the mobile shell
            to show the main pane (desktop ignores the param entirely). */}
        <Row to="/home?view=contacts" end>
          <Users className="size-4 shrink-0" /> Contacts
        </Row>
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-2 pb-4">
        <GroupLabel label="Direct messages" open={showDm} onToggle={() => setShowDm((v) => !v)} onAdd={() => setNewDm(true)} addLabel="New direct message" />
        {showDm && (
          <Row to="/home/dm/dm_self" active={dmId === "dm_self"}>
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-paper">
              <ShieldCheck className="size-3" />
            </span>
            <span className="min-w-0 flex-1 truncate">Notes to Self</span>
            <NavBadge>live</NavBadge>
          </Row>
        )}
        {showDm &&
          contacts.map((c) => (
            <Row key={c.userId} to={`/home/dm/${encodeURIComponent(c.userId)}`} active={dmId === c.userId}>
              <Avatar name={c.name} id={c.userId} size="sm" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <DmUnreadBadge peerId={c.userId} />
              <ShieldCheck className="size-3 shrink-0 text-positive/70" />
            </Row>
          ))}
        {showDm && contacts.length === 0 && (
          <button onClick={() => setNewDm(true)} className="mt-1 flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-[13px] text-ink-faint hover:bg-field hover:text-ink">
            <Plus className="size-4" /> New message
          </button>
        )}

        <div className="mt-2 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-faint">
          {sessionStatus === "open" ? (
            truncateHandle(useSession.getState().userId ?? "", 12, 6)
          ) : (
            <button onClick={() => useUnlockPrompt.getState().show()} className="underline underline-offset-2 hover:text-ink">
              session locked — unlock
            </button>
          )}
        </div>
      </div>

      {/* Live call panel — pinned to the sidebar bottom while in a call, Discord-style. */}
      <CallSidebarPanel />

      {newDm && <NewDmDialog onClose={() => setNewDm(false)} />}
    </aside>
  );
}
