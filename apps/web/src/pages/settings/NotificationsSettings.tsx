import { BellOff } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup } from "./parts";

export function NotificationsSettings() {
  return (
    <SettingsPage title="Notifications" desc="Tune what reaches you. Message previews stay on-device.">
      <SettingGroup>
        <div className="flex items-start gap-3 px-4 py-6">
          <BellOff className="mt-0.5 size-5 shrink-0 text-ink-faint" />
          <div>
            <div className="text-[14px] font-medium text-ink">Notification preferences aren't available yet</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">
              OS notifications ship with the desktop and mobile builds. Once they land, you'll
              control per-channel levels, sounds, and whether previews include message text here.
            </p>
          </div>
        </div>
      </SettingGroup>
    </SettingsPage>
  );
}
