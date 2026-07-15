import { useEffect, useRef } from "react";
import { Track, type Participant } from "livekit-client";
import { Volume2, VolumeX, MonitorUp } from "lucide-react";
import { useCallVolumes, MAX_VOLUME } from "@/stores/useCallVolumes";
import { cn, truncateHandle } from "@/lib/utils";

/**
 * Right-click menu on a call participant (T3): per-user volume slider (up to
 * 200% - gain boosting for quiet mics via WebAudio), a local mute toggle,
 * and a screenshare-audio slider when they're sharing with sound. Values
 * persist per handle (useCallVolumes) and are applied live by the tiles.
 */
export function ParticipantMenu({
  x,
  y,
  participant,
  onClose,
}: {
  x: number;
  y: number;
  participant: Participant;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = participant.identity.split("#")[0];
  const name = participant.name || truncateHandle(handle, 8, 4);
  const vol = useCallVolumes((s) => s.volumes[handle]);
  const setVolume = useCallVolumes((s) => s.setVolume);
  const setMuted = useCallVolumes((s) => s.setMuted);
  const hasShareAudio = !!participant.getTrackPublication(Track.Source.ScreenShareAudio);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the menu on screen near the cursor.
  const width = 250;
  const left = Math.min(x, window.innerWidth - width - 8);
  const top = Math.min(y, window.innerHeight - (hasShareAudio ? 220 : 170) - 8);

  return (
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        style={{ left, top, width }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute rounded-card border border-line bg-paper p-3 font-stack shadow-[var(--st-shadow-card)]"
      >
        <div className="truncate text-[13px] font-semibold text-ink">{name}</div>
        {participant.isLocal ? (
          <p className="mt-1 text-[12px] text-ink-mute">That's you - everyone sets their own listening volume.</p>
        ) : (
          <>
            <button
              onClick={() => setMuted(handle, !vol?.muted)}
              className={cn(
                "mt-2 flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-[12.5px] font-medium transition-colors",
                vol?.muted ? "bg-negative/10 text-negative hover:bg-negative/20" : "text-ink-mute hover:bg-field hover:text-ink",
              )}
            >
              <VolumeX className="size-4" />
              {vol?.muted ? "Muted for you - click to unmute" : "Mute for me"}
            </button>
            <VolumeSlider
              icon={<Volume2 className="size-3.5" />}
              label="User volume"
              disabled={!!vol?.muted}
              value={vol?.mic ?? 1}
              onChange={(v) => setVolume(handle, "mic", v)}
            />
            {hasShareAudio && (
              <VolumeSlider
                icon={<MonitorUp className="size-3.5" />}
                label="Screenshare audio"
                value={vol?.screen ?? 1}
                onChange={(v) => setVolume(handle, "screen", v)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VolumeSlider({
  icon,
  label,
  value,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className={cn("mt-2.5", disabled && "opacity-40")}>
      <div className="flex items-center justify-between text-[11.5px] text-ink-mute">
        <span className="inline-flex items-center gap-1.5">
          {icon} {label}
        </span>
        <span className={cn("font-mono text-[11px]", pct > 100 ? "text-positive" : "text-ink-faint")}>{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_VOLUME * 100}
        value={pct}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="mt-1 w-full accent-[color:var(--st-ink)]"
      />
    </div>
  );
}
