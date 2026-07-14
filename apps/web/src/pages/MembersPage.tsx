import { useState } from "react";
import { Search, UserPlus, Check, MessageSquare, ShieldCheck, Hammer, Loader2 } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { Button, Input, StackModal, ModalBody, StackToast, Field } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay, ADMIN_PERMISSIONS, type AdminPermission, type RelayMember } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { truncateHandle, cn } from "@/lib/utils";
import { useStartDm } from "@/lib/useStartDm";
import { inviteLink } from "@/lib/invite";

/**
 * Members directory + role/ban management (T2-07). Role assignment is
 * owner-only; ban/unban needs the "ban" permission. All of it is enforced
 * server-side at the relay — the buttons here are gated for UX, not security.
 */
export function MembersPage() {
  const workspace = useRelay((s) => s.workspace);
  const myId = useSession((s) => s.userId);
  const startDm = useStartDm();
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<RelayMember | null>(null);
  const [banTarget, setBanTarget] = useState<RelayMember | null>(null);

  const members = (workspace?.members ?? []).filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const bans = workspace?.bans ?? [];

  const me = workspace?.members.find((m) => m.userId === myId);
  const isOwner = me?.role === "owner";
  const canBan = isOwner || (me?.role === "admin" && (me.permissions ?? []).includes("ban"));

  const act = async (p: Promise<{ ok: true } | { ok: false; error: string }>) => {
    const res = await p;
    if (!res.ok) setNotice(res.error);
  };

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
            {members.map((m, i) => {
              const self = m.userId === myId;
              const targetIsOwner = m.role === "owner";
              return (
                <div
                  key={m.userId}
                  className="group flex w-full items-center gap-3 border-line bg-paper px-4 py-3 transition-colors hover:bg-paper-2"
                  style={{ borderTopWidth: i ? 1 : 0 }}
                >
                  <button onClick={() => startDm(m.userId, m.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Avatar name={m.name} id={m.userId} className="!size-9 !text-[13px]" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-ink">{m.name}</span>
                        {self && <span className="text-[12px] text-ink-faint">· you</span>}
                      </div>
                      <div className="font-mono text-[11px] text-ink-faint">{truncateHandle(m.userId, 16, 6)}</div>
                    </div>
                    <span className="ml-2 inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-[12.5px] text-ink-mute opacity-0 transition-opacity group-hover:opacity-100">
                      <MessageSquare className="size-3.5" /> {self ? "Notes" : "Message"}
                    </span>
                  </button>

                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {isOwner && !self && !targetIsOwner && (
                      <>
                        <button
                          onClick={() => setPromoteTarget(m)}
                          className="rounded-control px-2 py-1 text-[12px] text-ink-mute opacity-0 transition-all hover:bg-field hover:text-ink group-hover:opacity-100"
                        >
                          {m.role === "admin" ? "Edit permissions" : "Make admin"}
                        </button>
                        {m.role === "admin" && (
                          <button
                            onClick={() => void act(useRelay.getState().setRole(workspace!.id, m.userId, "member"))}
                            className="rounded-control px-2 py-1 text-[12px] text-ink-mute opacity-0 transition-all hover:bg-field hover:text-ink group-hover:opacity-100"
                          >
                            Remove admin
                          </button>
                        )}
                      </>
                    )}
                    {canBan && !self && !targetIsOwner && (
                      <button
                        onClick={() => setBanTarget(m)}
                        className="rounded-control px-2 py-1 text-[12px] text-negative opacity-0 transition-all hover:bg-negative/10 group-hover:opacity-100"
                      >
                        Ban
                      </button>
                    )}
                    <span
                      className={cn(
                        "rounded-control px-2 py-0.5 text-[11px] font-medium capitalize",
                        m.role === "owner" ? "bg-ink text-paper" : m.role === "admin" ? "bg-field text-ink" : "bg-field text-ink-mute",
                      )}
                      title={m.role === "admin" && m.permissions?.length ? `Permissions: ${m.permissions.join(", ")}` : undefined}
                    >
                      {m.role}
                    </span>
                  </div>
                </div>
              );
            })}
            {members.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-ink-faint">No members yet.</div>}
          </div>

          {canBan && bans.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-faint">
                <Hammer className="size-3.5" /> Banned · {bans.length}
              </h2>
              <div className="overflow-hidden rounded-card border border-line">
                {bans.map((b, i) => (
                  <div key={b.userId} className="flex items-center gap-3 bg-paper px-4 py-3" style={{ borderTopWidth: i ? 1 : 0 }}>
                    <Avatar name={b.name} id={b.userId} className="!size-8 !text-[12px] opacity-50" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-ink">{b.name}</div>
                      <div className="truncate text-[11.5px] text-ink-faint">
                        <span className="font-mono">{truncateHandle(b.userId, 12, 4)}</span>
                        {b.reason && <> · {b.reason}</>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void act(useRelay.getState().unbanMember(workspace!.id, b.userId))}>
                      Unban
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-6 text-[11.5px] leading-relaxed text-ink-faint">
            Roles and bans are enforced by the relay (transport). Note: the relay identifies members by
            their self-reported Gossip handle; it is workspace governance, not cryptographic auth.
          </p>
        </div>
      </div>

      {promoteTarget && workspace && (
        <PromoteDialog
          member={promoteTarget}
          onClose={() => setPromoteTarget(null)}
          onConfirm={(perms) => {
            setPromoteTarget(null);
            void act(useRelay.getState().setRole(workspace.id, promoteTarget.userId, "admin", perms));
          }}
        />
      )}
      {banTarget && workspace && (
        <BanDialog
          member={banTarget}
          onClose={() => setBanTarget(null)}
          onConfirm={(reason) => {
            setBanTarget(null);
            void act(useRelay.getState().banMember(workspace.id, banTarget.userId, reason));
          }}
        />
      )}
      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <StackToast tone="info" message={notice} onDismiss={() => setNotice(null)} />
        </div>
      )}
    </div>
  );
}

/** Owner picks the admin's permissions at promotion (pre-filled when editing). */
function PromoteDialog({
  member,
  onClose,
  onConfirm,
}: {
  member: RelayMember;
  onClose: () => void;
  onConfirm: (perms: AdminPermission[]) => void;
}) {
  const [perms, setPerms] = useState<Set<AdminPermission>>(new Set(member.permissions ?? []));
  const toggle = (p: AdminPermission) =>
    setPerms((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="mb-1 text-lg font-bold tracking-tight text-ink">
          {member.role === "admin" ? "Edit admin permissions" : "Promote to administrator"}
        </h2>
        <p className="mb-4 text-[13px] text-ink-mute">
          Choose what <span className="font-medium text-ink">{member.name}</span> can do. You can change this later.
        </p>
        <div className="space-y-1">
          {ADMIN_PERMISSIONS.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-start gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-field">
              <input type="checkbox" checked={perms.has(p.id)} onChange={() => toggle(p.id)} className="mt-0.5 size-4 accent-[var(--st-ink)]" />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">{p.label}</span>
                <span className="block text-[12px] text-ink-mute">{p.desc}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onConfirm([...perms])}>
            <ShieldCheck className="size-4" /> {member.role === "admin" ? "Save permissions" : "Make admin"}
          </Button>
        </div>
      </ModalBody>
    </StackModal>
  );
}

/** Ban confirmation with an optional reason. */
function BanDialog({
  member,
  onClose,
  onConfirm,
}: {
  member: RelayMember;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="mb-1 text-lg font-bold tracking-tight text-ink">Ban {member.name}?</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-mute">
          They are removed from the workspace immediately and can't rejoin (the invite code stops
          working for them) until unbanned.
        </p>
        <Field label="Reason (optional)">
          <Input placeholder="e.g. spam" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onConfirm(reason.trim());
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Hammer className="size-4" />} Ban member
          </Button>
        </div>
      </ModalBody>
    </StackModal>
  );
}
