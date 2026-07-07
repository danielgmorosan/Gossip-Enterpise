import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Avatar, Button, Field, Input } from "@gossip/ui/stack";
import { useSession } from "@/stores/useSession";
import { truncateHandle } from "@/lib/utils";

export function ProfileSettings() {
  const userId = useSession((s) => s.userId);
  const displayName = useSession((s) => s.displayName);
  const setDisplayName = useSession((s) => s.setDisplayName);
  const [name, setName] = useState(displayName);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setDisplayName(name.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <SettingsPage title="Profile" desc="How you appear across the workspace. Your identity carries no PII.">
      <SettingGroup title="Identity">
        <SettingRow
          label={
            <div className="flex items-center gap-3">
              <Avatar name={displayName || "You"} id={userId ?? displayName} className="!size-12 !text-[16px]" />
              <div>
                <div className="text-[15px] font-semibold text-ink">{displayName || "You"}</div>
                <div className="font-mono text-[11px] text-ink-faint">
                  {userId ? truncateHandle(userId, 16, 8) : "session locked"}
                </div>
              </div>
            </div>
          }
        />
        <SettingRow
          label="Pseudonymous handle"
          desc="Derived from your passphrase. This is your canonical, server-blind identity."
          control={
            <Button
              variant="secondary"
              size="sm"
              disabled={!userId}
              onClick={() => {
                if (!userId) return;
                navigator.clipboard?.writeText(userId);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          }
        />
      </SettingGroup>

      <SettingGroup title="Display">
        <div className="space-y-4 px-4 py-4">
          <Field label="Display name" hint="Shown to other members in group channels. Separate from your handle.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daniel" />
          </Field>
          <Button size="sm" onClick={save} disabled={!name.trim() || name.trim() === displayName}>
            {saved ? <><Check className="size-4" /> Saved</> : "Save"}
          </Button>
        </div>
      </SettingGroup>
    </SettingsPage>
  );
}
