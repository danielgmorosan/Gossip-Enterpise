import { useNavigate } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button } from "@gossip/ui/stack";
import { useSession } from "@/stores/useSession";

export function SecuritySettings() {
  const nav = useNavigate();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);

  const lock = async () => {
    await signOut();
    nav("/identity/unlock");
  };

  return (
    <SettingsPage title="Security" desc="Your keys, your sessions, your device locks.">
      <SettingGroup title="Encryption">
        <SettingRow
          label={
            <span className="flex items-center gap-2">
              Post-quantum E2E
              <span className="inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
                <span className="size-1.5 rounded-full bg-positive" /> active
              </span>
            </span>
          }
          desc="DMs use post-quantum key exchange with ephemeral per-message keys (forward secrecy). This is sealed — not configurable."
          control={<ShieldCheck className="size-6 text-positive" />}
        />
      </SettingGroup>

      <SettingGroup title="Session">
        <SettingRow
          label="Lock this session"
          desc="Closes your encrypted session on this device. You'll re-unlock with your recovery passphrase."
          control={
            <Button variant="danger" size="sm" onClick={lock} disabled={status !== "open"}>
              <KeyRound className="size-4" /> Lock session
            </Button>
          }
        />
      </SettingGroup>
    </SettingsPage>
  );
}
