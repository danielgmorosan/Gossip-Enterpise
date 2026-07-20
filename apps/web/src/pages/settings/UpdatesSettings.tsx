import { useCallback, useEffect, useState } from "react";
import { DownloadCloud, RefreshCw, CircleDot, RotateCw, ShieldCheck } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, Toggle } from "@umbry/ui/stack";
import { cn } from "@/lib/utils";
import { desktopUpdater, type UpdaterStatus } from "@/lib/desktopUpdater";

function stateLabel(s: UpdaterStatus): string {
  switch (s.state) {
    case "checking":
      return "checking for updates…";
    case "available":
      return `downloading ${s.newVersion ?? "update"}…`;
    case "downloading":
      return `downloading ${s.newVersion ?? "update"}… ${s.percent ?? 0}%`;
    case "downloaded":
      return `ready to install ${s.newVersion ?? ""}`.trim();
    case "not-available":
      return "up to date";
    case "error":
      return s.error ? `error: ${s.error}` : "update error";
    default:
      return "up to date";
  }
}

export function UpdatesSettings() {
  const updater = desktopUpdater();
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!updater) return;
    void updater.status().then(setStatus);
    return updater.onEvent(setStatus);
  }, [updater]);

  const check = useCallback(async () => {
    if (!updater) return;
    setBusy(true);
    try {
      setStatus(await updater.check());
    } finally {
      setBusy(false);
    }
  }, [updater]);

  const toggle = useCallback(
    async (enabled: boolean) => {
      if (!updater) return;
      setStatus(await updater.setEnabled(enabled));
    },
    [updater],
  );

  const install = useCallback(async () => {
    if (!updater) return;
    setStatus(await updater.install());
  }, [updater]);

  // Web build: no desktop shell, nothing to update.
  if (!updater) {
    return (
      <SettingsPage title="Updates" desc="Automatic updates for the Umbry desktop app.">
        <div className="flex items-start gap-3 rounded-card border border-line bg-paper-2 p-4">
          <DownloadCloud className="mt-0.5 size-5 shrink-0 text-ink-mute" />
          <p className="text-[13px] leading-relaxed text-ink-mute">
            <span className="font-medium text-ink">You're on the web app, which always runs the latest version.</span>{" "}
            Auto-update applies to the installed desktop app — it checks in the background and updates in place, so you
            never re-download or sign in again.
          </p>
        </div>
      </SettingsPage>
    );
  }

  const s = status;
  const downloaded = s?.state === "downloaded";
  const checking = busy || s?.state === "checking" || s?.state === "downloading" || s?.state === "available";

  return (
    <SettingsPage
      title="Updates"
      desc="Keep Umbry current automatically. Updates install in place and preserve everything — your identity, unlock, and history all carry over."
    >
      <SettingGroup>
        <SettingRow
          label="Automatic updates"
          desc="Check for new versions in the background and stage them to install when you quit."
          control={
            <Toggle checked={s?.enabled ?? true} onChange={toggle} label="Automatic updates" disabled={!s} />
          }
        />
        <SettingRow
          label="Status"
          desc={`Current version ${s?.version ?? "…"}${s && !s.supported ? " · dev build (updates disabled)" : ""}`}
          control={
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-control px-3 py-1.5 font-mono text-[12px]",
                  s?.state === "downloaded" ? "bg-field text-positive" : "bg-field text-ink-faint",
                )}
              >
                <CircleDot className={cn("size-3.5", checking && "animate-pulse")} />
                {s ? stateLabel(s) : "…"}
              </span>
              <Button variant="ghost" size="sm" onClick={check} disabled={!s?.supported || checking}>
                <RefreshCw className={cn("size-4", checking && "animate-spin")} /> Check now
              </Button>
            </div>
          }
        />
        {downloaded && (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <p className="text-[12.5px] leading-relaxed text-ink-mute">
              Version <span className="font-mono text-ink">{s?.newVersion}</span> is downloaded. Restart to finish
              installing — your session and data are untouched.
            </p>
            <Button size="sm" onClick={install} className="shrink-0">
              <RotateCw className="size-4" /> Restart to update
            </Button>
          </div>
        )}
      </SettingGroup>

      <div className="flex items-start gap-2.5 rounded-card border border-line bg-paper-2 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" />
        <p className="text-[12.5px] leading-relaxed text-ink-mute">
          Updates are fetched from the official GitHub releases and applied in place. Your recovery passphrase,
          biometric unlock, and local data live in the app's storage and are never removed by an update — you won't be
          logged out.
        </p>
      </div>
    </SettingsPage>
  );
}
