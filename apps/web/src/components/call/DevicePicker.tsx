import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, Video, Check } from "lucide-react";
import { useCall } from "@/stores/useCall";
import { useAudioSettings } from "@/stores/useAudioSettings";
import { cn } from "@/lib/utils";

/**
 * In-call device picker (T3), Discord-style: switch mic, speaker, and camera
 * live without leaving the call. Opens from the control tray's gear.
 */
export function DevicePicker({ onClose }: { onClose: () => void }) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputId = useAudioSettings((s) => s.inputId);
  const outputId = useAudioSettings((s) => s.outputId);

  const refresh = async () => {
    try {
      // Labels only populate after a getUserMedia grant, which a live call has.
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter((d) => d.kind === "audioinput"));
      setSpeakers(devices.filter((d) => d.kind === "audiooutput"));
      setCams(devices.filter((d) => d.kind === "videoinput"));
    } catch {
      /* enumeration blocked */
    }
  };

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speakerSelectable = "setSinkId" in HTMLMediaElement.prototype;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-1/2 z-40 mb-3 max-h-[60vh] w-72 -translate-x-1/2 overflow-y-auto rounded-card border border-line bg-paper p-2 font-stack shadow-[var(--st-shadow-card)]"
    >
      <DeviceGroup icon={<Mic className="size-3.5" />} label="Microphone" devices={mics} kind="audioinput" activeId={inputId} />
      {speakerSelectable && (
        <DeviceGroup icon={<Volume2 className="size-3.5" />} label="Speaker" devices={speakers} kind="audiooutput" activeId={outputId} />
      )}
      {cams.length > 0 && <DeviceGroup icon={<Video className="size-3.5" />} label="Camera" devices={cams} kind="videoinput" activeId="" />}
      {!speakerSelectable && (
        <p className="px-2 pb-1 pt-1.5 text-[10.5px] text-ink-faint">Speaker selection isn't supported in this browser.</p>
      )}
    </div>
  );
}

function DeviceGroup({
  icon,
  label,
  devices,
  kind,
  activeId,
}: {
  icon: React.ReactNode;
  label: string;
  devices: MediaDeviceInfo[];
  kind: MediaDeviceKind;
  /** Persisted deviceId to mark as current (audio); "" for camera. */
  activeId: string;
}) {
  const [current, setCurrent] = useState<string>(activeId);
  return (
    <div className="mb-1.5 last:mb-0">
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {icon} {label}
      </div>
      {devices.length === 0 ? (
        <p className="px-2 py-1 text-[12px] text-ink-faint">No devices found.</p>
      ) : (
        devices.map((d) => (
          <button
            key={d.deviceId}
            onClick={async () => {
              setCurrent(d.deviceId);
              await useCall.getState().switchDevice(kind, d.deviceId);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-field",
              current === d.deviceId ? "text-ink" : "text-ink-mute",
            )}
          >
            <span className="grid size-4 shrink-0 place-items-center">
              {current === d.deviceId && <Check className="size-3.5 text-positive" />}
            </span>
            <span className="min-w-0 truncate">{d.label || `${label} ${d.deviceId.slice(0, 6)}`}</span>
          </button>
        ))
      )}
    </div>
  );
}
