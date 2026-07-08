import { useEffect, useState, type ReactNode } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from "lucide-react";
import { RoomContext, RoomAudioRenderer } from "@livekit/components-react";
import { useCall, callPath } from "@/stores/useCall";
import { router } from "@/app/router";
import { cn } from "@/lib/utils";

/**
 * Discord-style persistent call dock (T-14). Mounted OUTSIDE the router (in
 * main.tsx), so it survives every navigation. While a call is active and the
 * user is anywhere but the call page it shows compact controls and — key —
 * keeps a RoomAudioRenderer mounted so remote audio keeps playing. On the
 * call page itself both are skipped (VideoConference has its own renderer;
 * double renderers would double the audio).
 */
export function CallDock() {
  const room = useCall((s) => s.room);
  const status = useCall((s) => s.status);
  const target = useCall((s) => s.target);
  const mic = useCall((s) => s.mic);
  const cam = useCall((s) => s.cam);
  const screen = useCall((s) => s.screen);
  const { toggleMic, toggleCam, toggleScreen, leave } = useCall.getState();

  const [path, setPath] = useState(router.state.location.pathname);
  useEffect(() => router.subscribe((s) => setPath(s.location.pathname)), []);

  if (status === "idle" || !room || !target) return null;
  const onCallPage = path === callPath(target);
  if (onCallPage) return null;

  return (
    <RoomContext.Provider value={room}>
      {/* Remote audio keeps playing on every route. */}
      <RoomAudioRenderer />
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-card border border-line bg-paper p-1.5 font-stack shadow-[var(--st-shadow-card)]">
        <button
          onClick={() => void router.navigate(callPath(target))}
          title="Return to call"
          className="mr-0.5 flex min-w-0 items-center gap-2 rounded-control px-2 py-1 text-left transition-colors hover:bg-field"
        >
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-positive" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-[140px] truncate text-[12.5px] font-semibold text-ink">
              {target.kind === "channel" ? `#${target.label}` : target.label}
            </span>
            <span className="block text-[10.5px] text-ink-faint">
              {status === "connected" ? "in call — click to return" : "connecting…"}
            </span>
          </span>
        </button>
        <DockBtn label={mic ? "Mute mic" : "Unmute mic"} active={mic} onClick={() => void toggleMic()}>
          {mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </DockBtn>
        <DockBtn label={cam ? "Turn camera off" : "Turn camera on"} active={cam} onClick={() => void toggleCam()}>
          {cam ? <Video className="size-4" /> : <VideoOff className="size-4" />}
        </DockBtn>
        <DockBtn label={screen ? "Stop sharing" : "Share screen"} active={screen} onClick={() => void toggleScreen()}>
          <MonitorUp className="size-4" />
        </DockBtn>
        <button
          onClick={() => void leave()}
          title="Leave call"
          aria-label="Leave call"
          className="grid size-8 place-items-center rounded-control bg-negative text-white transition-opacity hover:opacity-90"
        >
          <PhoneOff className="size-4" />
        </button>
      </div>
    </RoomContext.Provider>
  );
}

function DockBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid size-8 place-items-center rounded-control transition-colors",
        active ? "bg-field text-ink" : "text-ink-mute hover:bg-field hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
