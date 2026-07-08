import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Crown, LogOut } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, CopyField, DangerZone, DangerRow, ConfirmDestructiveModal } from "@gossip/ui/stack";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { useRelay } from "@/stores/useRelay";
import { truncateHandle } from "@/lib/utils";
import { inviteLink } from "@/lib/invite";

export function WorkspaceSettings() {
  const nav = useNavigate();
  const workspace = useRelay((s) => s.workspace);
  const myWorkspaces = useRelay((s) => s.myWorkspaces);
  const leaveWorkspace = useRelay((s) => s.leaveWorkspace);
  const current = workspace ?? null;
  const wsId = current?.id ?? myWorkspaces[0]?.id ?? "";
  const name = current?.name ?? myWorkspaces[0]?.name ?? "—";
  const code = current?.code ?? myWorkspaces[0]?.code ?? "";
  const members = current?.members ?? [];
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const confirmLeave = async () => {
    if (typedName.trim() !== name) return;
    const res = await leaveWorkspace(wsId);
    if (!res.ok) {
      setLeaveError(res.error);
      return;
    }
    setConfirming(false);
    const remaining = useRelay.getState().myWorkspaces;
    nav(remaining[0] ? `/w/${remaining[0].id}` : "/welcome");
  };

  return (
    <SettingsPage title="Workspace" desc="Your workspace identity, transport, and membership.">
      <SettingGroup title="General">
        <SettingRow label="Name" desc="Set when the workspace was created." control={<span className="text-[14px] font-medium text-ink">{name}</span>} />
        <div className="px-4 py-4">
          <div className="mb-2 text-[14px] font-medium text-ink">Invite link</div>
          <div className="mb-2 text-[12.5px] text-ink-mute">
            Anyone with this link lands in the join flow with the code ({code || "—"}) prefilled.
          </div>
          <CopyField
            value={copied ? "Copied!" : code ? inviteLink(code) : "no invite code"}
            onCopy={() => {
              if (!code) return;
              navigator.clipboard?.writeText(inviteLink(code));
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          />
        </div>
      </SettingGroup>

      <SettingGroup title="Channel privacy">
        <div className="flex items-start gap-3 px-4 py-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-ink-mute" />
          <p className="text-[13px] leading-relaxed text-ink-mute">
            <span className="font-medium text-ink">Channels are workspace-confidential, not E2E in v1.</span>{" "}
            Transport is TLS and contents persist to the relay store. DMs remain end-to-end
            encrypted. A group-E2E upgrade (fan-out → MLS) is on the roadmap.
          </p>
        </div>
      </SettingGroup>

      <SettingGroup title={`Members · ${members.length}`}>
        {members.map((m) => (
          <SettingRow
            key={m.userId}
            label={
              <div className="flex items-center gap-3">
                <Avatar name={m.name} id={m.userId} className="!size-8 !text-[12px]" />
                <div>
                  <div className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
                    {m.name}
                    {m.role === "owner" && <Crown className="size-3.5 text-ink-mute" />}
                  </div>
                  <div className="font-mono text-[11px] text-ink-faint">{truncateHandle(m.userId, 14, 6)}</div>
                </div>
              </div>
            }
            control={<span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium capitalize text-ink-mute">{m.role}</span>}
          />
        ))}
        {members.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px] text-ink-faint">
            Open the workspace to load its member list.
          </div>
        )}
      </SettingGroup>

      {wsId && (
        <DangerZone>
          <DangerRow
            label="Leave this workspace"
            description="Removes you from the member list and from this device. Rejoin anytime with the invite code."
            action={
              <Button variant="danger" size="sm" onClick={() => { setTypedName(""); setAcknowledged(false); setLeaveError(null); setConfirming(true); }}>
                <LogOut className="size-4" /> Leave
              </Button>
            }
          />
        </DangerZone>
      )}

      {confirming && (
        <ConfirmDestructiveModal
          title={`Leave ${name}?`}
          description={
            <>
              You'll be removed from the member list and this workspace disappears from your
              sidebar. Your channel messages stay. You can rejoin with the invite code.
              {leaveError && <span className="mt-2 block text-negative">{leaveError}</span>}
            </>
          }
          codeLabel={`Type the workspace name (${name}) to confirm`}
          codeValue={typedName}
          onCodeChange={setTypedName}
          acknowledgeLabel="I understand I'll need an invite code to rejoin."
          acknowledged={acknowledged}
          onAcknowledgeChange={setAcknowledged}
          confirmLabel="Leave workspace"
          onConfirm={confirmLeave}
          onClose={() => setConfirming(false)}
        />
      )}
    </SettingsPage>
  );
}
