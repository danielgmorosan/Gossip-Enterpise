import { useEffect, useState, type ReactNode } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { RoomContext, RoomAudioRenderer } from "@livekit/components-react";
import { useCall, callPath } from "@/stores/useCall";
import { router } from "@/app/router";
import { cn } from "@/lib/utils";

/**
 * Persistent call presence (T-14). Mounted OUTSIDE the router (in main.tsx),
 * so it survives every navigation, and — key — keeps a RoomAudioRenderer
 * mounted so remote audio keeps playing on every route. On the call page
 * itself the renderer is skipped (CallStage has its own; double renderers
 * would double the audio).
 *
 * The visible controls live in the sidebar (CallSidebarPanel, Discord-style)
 * so nothing floats over the UI. The floating pill only appears on routes
 * with no sidebar to host the panel (settings, dev pages) — the leave button
 * must never be more than one glance away during a call.
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

  // /home and /w/… render a sidebar that hosts CallSidebarPanel.
  const sidebarHosted = path.startsWith("/home") || path.startsWith("/w/");

  return (
    <RoomContext.Provider value={room}>
      {/* Remote audio keeps playing on every route. */}
      <RoomAudioRenderer />
      {!sidebarHosted && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-1 rounded-card border border-line bg-paper p-1.5 font-stack shadow-[var(--st-shadow-card)]">
          <button
            onClick={() => void router.navigate(callPath(target))}
            title="Return to call"
            className="mr-0.5 flex min-w-0 items-center gap-2 rounded-control px-2 py-1 text-left transition-colors hover:bg-field"
          >
            <LiveDot />
            <span className="min-w-0">
              <span className="block max-w-[140px] truncate text-[12.5px] font-semibold text-ink">
                {target.kind === "channel" ? `#${target.label}` : target.label}
              </span>
              <span className="block text-[10.5px] text-ink-faint">
                {status === "connected" ? "in call, click to return" : "connecting…"}
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
          <Tooltip label="Leave call">
            <button
              onClick={() => void leave()}
              aria-label="Leave call"
              className="grid size-8 place-items-center rounded-control bg-negative text-white transition-opacity hover:opacity-90"
            >
              <PhoneOff className="size-4" />
            </button>
          </Tooltip>
        </div>
      )}
    </RoomContext.Provider>
  );
}

/**
 * In-sidebar call panel (Discord's "voice connected" block). Pinned above the
 * bottom of both sidebars while a call is live: status row navigates back to
 * the call, controls row below. Renders nothing when no call is active.
 * Audio is NOT handled here — CallDock's renderer covers every route.
 */
export function CallSidebarPanel() {
  const status = useCall((s) => s.status);
  const target = useCall((s) => s.target);
  const mic = useCall((s) => s.mic);
  const cam = useCall((s) => s.cam);
  const screen = useCall((s) => s.screen);
  const { toggleMic, toggleCam, toggleScreen, leave } = useCall.getState();

  if (status === "idle" || !target) return null;

  return (
    <div className="shrink-0 border-t border-line bg-paper-2 px-2 py-2 font-stack">
      <button
        onClick={() => void router.navigate(callPath(target))}
        title="Return to call"
        className="flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1 text-left transition-colors hover:bg-field"
      >
        <LiveDot />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-ink">
            {target.kind === "channel" ? `#${target.label}` : target.label}
          </span>
          <span className="block text-[10.5px] text-ink-faint">
            {status === "connected" ? "in call, click to return" : "connecting…"}
          </span>
        </span>
      </button>
      <div className="mt-1.5 grid grid-cols-4 gap-1">
        <DockBtn wide label={mic ? "Mute mic" : "Unmute mic"} active={mic} onClick={() => void toggleMic()}>
          {mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </DockBtn>
        <DockBtn wide label={cam ? "Turn camera off" : "Turn camera on"} active={cam} onClick={() => void toggleCam()}>
          {cam ? <Video className="size-4" /> : <VideoOff className="size-4" />}
        </DockBtn>
        <DockBtn wide label={screen ? "Stop sharing" : "Share screen"} active={screen} onClick={() => void toggleScreen()}>
          <MonitorUp className="size-4" />
        </DockBtn>
        <Tooltip label="Leave call">
          <button
            onClick={() => void leave()}
            aria-label="Leave call"
            className="grid h-8 w-full place-items-center rounded-control bg-negative text-white transition-opacity hover:opacity-90"
          >
            <PhoneOff className="size-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-2.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
      <span className="relative inline-flex size-2.5 rounded-full bg-positive" />
    </span>
  );
}

function DockBtn({
  label,
  active,
  wide,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  /** Stretch to fill a grid cell (sidebar panel) instead of the fixed pill size. */
  wide?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "grid place-items-center rounded-control transition-colors",
          wide ? "h-8 w-full" : "size-8",
          active ? "bg-field text-ink" : "text-ink-mute hover:bg-field hover:text-ink",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
