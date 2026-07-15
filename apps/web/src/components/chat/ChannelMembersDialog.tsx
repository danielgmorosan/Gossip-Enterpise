import { useMemo, useState } from "react";
import { Lock, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { Button, StackModal, ModalBody, Tooltip } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay, type RelayChannel } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { truncateHandle } from "@/lib/utils";

/**
 * Private-channel membership management (T2-08). Members see the roster;
 * the channel creator + owner/admins with manageMembers can invite and
 * remove; anyone can remove themselves (leave). The buttons are UX gating -
 * the relay enforces every action server-side.
 */
export function ChannelMembersDialog({
  workspaceId,
  channel,
  onClose,
}: {
  workspaceId: string;
  channel: RelayChannel;
  onClose: () => void;
}) {
  const workspace = useRelay((s) => s.workspace);
  const myId = useSession((s) => s.userId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = workspace?.members.find((m) => m.userId === myId);
  const canManage =
    channel.createdBy === myId ||
    me?.role === "owner" ||
    (me?.role === "admin" && (me.permissions ?? []).includes("manageMembers"));

  const memberIds = useMemo(() => new Set(channel.members ?? []), [channel.members]);
  const inChannel = (workspace?.members ?? []).filter((m) => memberIds.has(m.userId));
  const invitable = (workspace?.members ?? []).filter((m) => !memberIds.has(m.userId));

  const run = async (id: string, p: Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusyId(id);
    setError(null);
    const res = await p;
    setBusyId(null);
    if (!res.ok) setError(res.error);
  };

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
          <Lock className="size-4" /> {channel.name}
        </h2>
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-mute">
          Invite-only private channel, enforced by the relay. Contents are workspace-confidential, not E2E.
        </p>

        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Members · {inChannel.length}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-card border border-line">
          {inChannel.map((m, i) => {
            const self = m.userId === myId;
            const isCreator = m.userId === channel.createdBy;
            const removable = (self || (canManage && !isCreator)) && busyId === null;
            return (
              <div key={m.userId} className="flex items-center gap-2.5 bg-paper px-3 py-2" style={{ borderTopWidth: i ? 1 : 0 }}>
                <Avatar name={m.name} id={m.userId} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium text-ink">{m.name}</span>
                  {self && <span className="ml-1 text-[11px] text-ink-faint">· you</span>}
                  {isCreator && <span className="ml-1 text-[11px] text-ink-faint">· creator</span>}
                </div>
                {removable && (
                  <Tooltip label={self ? "Leave channel" : `Remove ${m.name}`}>
                    <button
                      onClick={() => void run(m.userId, useRelay.getState().removeChannelMember(workspaceId, channel.id, m.userId))}
                      aria-label={self ? "Leave channel" : `Remove ${m.name}`}
                      className="grid size-7 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-negative"
                    >
                      {busyId === m.userId ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
                    </button>
                  </Tooltip>
                )}
              </div>
            );
          })}
          {inChannel.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-ink-faint">No members.</div>}
        </div>

        {canManage && invitable.length > 0 && (
          <>
            <div className="mb-1 mt-4 text-[11px] font-medium uppercase tracking-wider text-ink-faint">Invite from workspace</div>
            <div className="max-h-40 overflow-y-auto rounded-card border border-line">
              {invitable.map((m, i) => (
                <div key={m.userId} className="flex items-center gap-2.5 bg-paper px-3 py-2" style={{ borderTopWidth: i ? 1 : 0 }}>
                  <Avatar name={m.name} id={m.userId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-ink">{m.name}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-ink-faint">{truncateHandle(m.userId, 8, 4)}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId !== null}
                    onClick={() => void run(m.userId, useRelay.getState().addChannelMember(workspaceId, channel.id, m.userId))}
                  >
                    {busyId === m.userId ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />} Invite
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-[13px] text-negative">{error}</p>}
      </ModalBody>
    </StackModal>
  );
}
