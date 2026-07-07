import { Moon, Sun, Check } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup } from "./parts";
import { useTheme } from "@/stores/useTheme";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { theme, set } = useTheme();

  return (
    <SettingsPage title="Appearance" desc="Make the workspace yours. Dark is the Gossip default.">
      <SettingGroup title="Theme">
        <div className="grid grid-cols-2 gap-3 p-4">
          {(["dark", "light"] as const).map((t) => {
            const active = theme === t;
            const dark = t === "dark";
            return (
              <button
                key={t}
                onClick={() => set(t)}
                className={cn(
                  "relative overflow-hidden rounded-card border-2 p-1 text-left transition-colors",
                  active ? "border-ink" : "border-line hover:border-line-strong",
                )}
              >
                <div
                  className="flex h-28 flex-col gap-2 rounded-control p-3"
                  style={{ background: dark ? "#0a0a0a" : "#fafafa" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full" style={{ background: dark ? "#fafafa" : "#0a0a0a" }} />
                    <span className="h-2 w-16 rounded-full" style={{ background: dark ? "#262626" : "#e5e5e5" }} />
                  </div>
                  <span className="h-2 w-24 rounded-full" style={{ background: dark ? "#1a1a1a" : "#e5e5e5" }} />
                  <span className="mt-auto h-6 w-20 self-end rounded-control" style={{ background: dark ? "#fafafa" : "#0a0a0a" }} />
                </div>
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium capitalize text-ink">
                    {dark ? <Moon className="size-4" /> : <Sun className="size-4" />} {t}
                  </span>
                  {active && (
                    <span className="grid size-5 place-items-center rounded-full bg-ink text-paper">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SettingGroup>
    </SettingsPage>
  );
}
