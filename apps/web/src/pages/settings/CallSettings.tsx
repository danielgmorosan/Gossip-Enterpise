import { useCallback, useEffect, useState } from "react";
import { Mic, Volume2, RefreshCw, AudioWaveform } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, Toggle } from "@gossip/ui/stack";
import { useAudioSettings } from "@/stores/useAudioSettings";
import { useAdvancedAudio } from "@/stores/useAdvancedAudio";
import { useCall } from "@/stores/useCall";
import { syncNoiseGate, updateNoiseGate } from "@/lib/audioProcessing";
import { cn } from "@/lib/utils";

/**
 * Calls & audio settings (T-12). Device labels require mic permission - the
 * "Allow device access" button requests it once, then enumerates. Selections
 * persist (zustand/persist) and are applied to the next LiveKit call via
 * CallPage's room options (output uses setSinkId where supported).
 */
export function CallSettings() {
  const settings = useAudioSettings();
  const adv = useAdvancedAudio();
  const callRoom = useCall((s) => s.room);
  const callLive = useCall((s) => s.status === "connected");

  /** Apply advanced-audio changes: persist, live-update the worklet, and
   *  attach/detach the processor on an active call. */
  const setAdv = (patch: Partial<{ enabled: boolean; thresholdDb: number; gainDb: number }>) => {
    adv.set(patch);
    updateNoiseGate(patch);
    if (patch.enabled !== undefined && callRoom) void syncNoiseGate(callRoom);
  };
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const ins = devices.filter((d) => d.kind === "audioinput");
      const outs = devices.filter((d) => d.kind === "audiooutput");
      // Without permission, labels come back empty - offer the request button.
      setNeedsPermission(ins.length > 0 && ins.every((d) => !d.label));
      setInputs(ins);
      setOutputs(outs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not list audio devices.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const requestPermission = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // permission only - release the mic
      await refresh();
    } catch {
      setError("Microphone access was denied. Device names stay hidden without it.");
    }
  };

  const supportsSinkId = "setSinkId" in HTMLMediaElement.prototype;

  return (
    <SettingsPage title="Calls & audio" desc="Pick your devices and audio processing. Applies to your next call.">
      <SettingGroup title="Devices">
        {needsPermission && (
          <SettingRow
            label="Device names are hidden"
            desc="The browser only reveals device names after microphone permission."
            control={
              <Button variant="secondary" size="sm" onClick={() => void requestPermission()}>
                <Mic className="size-4" /> Allow device access
              </Button>
            }
          />
        )}
        <SettingRow
          label={
            <span className="inline-flex items-center gap-2">
              <Mic className="size-4 text-ink-faint" /> Microphone
            </span>
          }
          desc="Input device for calls."
          control={
            <DeviceSelect
              devices={inputs}
              value={settings.inputId}
              fallbackLabel="Microphone"
              onChange={(id) => settings.set({ inputId: id })}
            />
          }
        />
        <SettingRow
          label={
            <span className="inline-flex items-center gap-2">
              <Volume2 className="size-4 text-ink-faint" /> Speaker
            </span>
          }
          desc={supportsSinkId ? "Output device for call audio." : "Output selection isn't supported by this browser (no setSinkId), so the system default is used."}
          control={
            <DeviceSelect
              devices={outputs}
              value={settings.outputId}
              fallbackLabel="Speaker"
              disabled={!supportsSinkId}
              onChange={(id) => settings.set({ outputId: id })}
            />
          }
        />
        <SettingRow
          label="Rescan devices"
          desc="Plugged something in? Refresh the list."
          control={
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="size-4" /> Rescan
            </Button>
          }
        />
        {error && <p className="px-4 pb-3 text-[12.5px] text-negative">{error}</p>}
      </SettingGroup>

      <SettingGroup title="Processing">
        <SettingRow
          label="Echo cancellation"
          desc="Prevents your speakers from feeding back into your mic."
          control={<Toggle checked={settings.echoCancellation} onChange={(v) => settings.set({ echoCancellation: v })} label="Echo cancellation" />}
        />
        <SettingRow
          label="Noise suppression"
          desc="Filters steady background noise (fans, hum)."
          control={<Toggle checked={settings.noiseSuppression} onChange={(v) => settings.set({ noiseSuppression: v })} label="Noise suppression" />}
        />
        <SettingRow
          label="Auto gain control"
          desc="Keeps your voice at a steady volume."
          control={<Toggle checked={settings.autoGainControl} onChange={(v) => settings.set({ autoGainControl: v })} label="Auto gain control" />}
        />
      </SettingGroup>

      <SettingGroup title="Advanced: noise gate">
        <SettingRow
          label={
            <span className="inline-flex items-center gap-2">
              <AudioWaveform className="size-4 text-ink-faint" /> Noise gate + gain
              {callLive && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                    adv.speaking ? "bg-positive/15 text-positive" : "bg-field text-ink-faint",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", adv.speaking ? "bg-positive" : "bg-ink-faint")} />
                  {adv.speaking ? "voice detected" : `quiet · ${adv.levelDb} dB`}
                </span>
              )}
            </span>
          }
          desc="Silences your mic below the threshold and applies extra gain. Runs in a local AudioWorklet on the outgoing track only."
          control={<Toggle checked={adv.enabled} onChange={(v) => setAdv({ enabled: v })} label="Noise gate" />}
        />
        <SettingRow
          label="Gate threshold"
          desc={`Signal below ${adv.thresholdDb} dB is muted. Raise it in noisy rooms.`}
          control={
            <label className="flex items-center gap-3">
              <input
                type="range"
                min={-70}
                max={-20}
                step={1}
                value={adv.thresholdDb}
                disabled={!adv.enabled}
                onChange={(e) => setAdv({ thresholdDb: Number(e.target.value) })}
                className="w-40 accent-[color:var(--st-ink)]"
                aria-label="Gate threshold in dB"
              />
              <span className="w-14 text-right font-mono text-[12px] text-ink-mute">{adv.thresholdDb} dB</span>
            </label>
          }
        />
        <SettingRow
          label="Output gain"
          desc="Boost (or trim) your voice after the gate."
          control={
            <label className="flex items-center gap-3">
              <input
                type="range"
                min={-10}
                max={12}
                step={1}
                value={adv.gainDb}
                disabled={!adv.enabled}
                onChange={(e) => setAdv({ gainDb: Number(e.target.value) })}
                className="w-40 accent-[color:var(--st-ink)]"
                aria-label="Output gain in dB"
              />
              <span className="w-14 text-right font-mono text-[12px] text-ink-mute">
                {adv.gainDb > 0 ? `+${adv.gainDb}` : adv.gainDb} dB
              </span>
            </label>
          }
        />
      </SettingGroup>
    </SettingsPage>
  );
}

function DeviceSelect({
  devices,
  value,
  fallbackLabel,
  disabled,
  onChange,
}: {
  devices: MediaDeviceInfo[];
  value: string;
  fallbackLabel: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-[200px] max-w-[260px] rounded-control border border-line bg-field px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-line-strong focus:ring-2 focus:ring-[color:var(--st-ring)] disabled:text-ink-faint"
    >
      <option value="">System default</option>
      {devices.map((d, i) => (
        <option key={d.deviceId || i} value={d.deviceId}>
          {d.label || `${fallbackLabel} ${i + 1}`}
        </option>
      ))}
    </select>
  );
}
