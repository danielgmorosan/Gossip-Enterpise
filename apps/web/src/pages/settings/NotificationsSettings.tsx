import { Hash, Lock, AtSign, MessageSquare, Users, Phone, ShieldCheck } from "lucide-react";
import { Toggle } from "@gossip/ui/stack";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { useNotifications, type NotifType } from "@/stores/useNotifications";
import { useRelay } from "@/stores/useRelay";
import { useContacts } from "@/stores/useContacts";

const typeRows: { id: NotifType; icon: typeof MessageSquare; label: string; desc: string }[] = [
  { id: "message", icon: MessageSquare, label: "Channel messages", desc: "New messages in channels you're in." },
  { id: "mention", icon: AtSign, label: "Mentions", desc: "Someone @mentions you in a channel." },
  { id: "dm", icon: Lock, label: "Direct messages", desc: "New encrypted DMs. Notifications never include message content." },
  { id: "membership", icon: Users, label: "Membership", desc: "Someone joins the workspace, or you're added to a private channel." },
  { id: "call", icon: Phone, label: "Calls", desc: "A call starts in one of your channels." },
];

export function NotificationsSettings() {
  const prefs = useNotifications((s) => s.prefs);
  const { setTypeEnabled, setOsEnabled, setSoundEnabled, toggleMuteChannel, toggleMuteDm } = useNotifications.getState();
  const workspace = useRelay((s) => s.workspace);
  const contacts = useContacts((s) => s.contacts);

  return (
    <SettingsPage title="Notifications" desc="Everything is decided on this device. DM notifications never include message content.">
      <SettingGroup title="What notifies you">
        {typeRows.map((t) => (
          <SettingRow
            key={t.id}
            label={
              <span className="inline-flex items-center gap-2">
                <t.icon className="size-4 text-ink-faint" /> {t.label}
              </span>
            }
            desc={t.desc}
            control={<Toggle checked={prefs.types[t.id]} onChange={(v: boolean) => setTypeEnabled(t.id, v)} />}
          />
        ))}
      </SettingGroup>

      <SettingGroup title="Delivery">
        <SettingRow
          label="System notifications"
          desc="Show an OS notification when the app is in the background. Asks for browser permission on enable."
          control={<Toggle checked={prefs.os} onChange={(v: boolean) => void setOsEnabled(v)} />}
        />
        <SettingRow
          label="Sound"
          desc="A short beep with each notification (generated locally, no assets)."
          control={<Toggle checked={prefs.sound} onChange={(v: boolean) => setSoundEnabled(v)} />}
        />
      </SettingGroup>

      {workspace && workspace.channels.length > 0 && (
        <SettingGroup title={`Muted channels · ${workspace.name}`}>
          {workspace.channels.map((c) => (
            <SettingRow
              key={c.id}
              label={
                <span className="inline-flex items-center gap-2">
                  {c.type === "private" ? <Lock className="size-4 text-ink-faint" /> : <Hash className="size-4 text-ink-faint" />}
                  {c.name}
                </span>
              }
              control={
                <Toggle checked={!prefs.mutedChannels.includes(c.id)} onChange={() => toggleMuteChannel(c.id)} />
              }
            />
          ))}
        </SettingGroup>
      )}

      {contacts.length > 0 && (
        <SettingGroup title="Muted conversations">
          {contacts.map((c) => (
            <SettingRow
              key={c.userId}
              label={
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-4 text-positive/70" /> {c.name}
                </span>
              }
              control={<Toggle checked={!prefs.mutedDms.includes(c.userId)} onChange={() => toggleMuteDm(c.userId)} />}
            />
          ))}
        </SettingGroup>
      )}
    </SettingsPage>
  );
}
