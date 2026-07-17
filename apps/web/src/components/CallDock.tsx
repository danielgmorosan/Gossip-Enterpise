import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from "lucide-react";
import { Tooltip } from "@umbry/ui/stack";
import {
  RoomContext,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useTracks,
  useParticipants,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useCall, callPath } from "@/stores/useCall";
import { UserAvatar } from "@/components/UserAvatar";
import { LiveBars } from "@/components/LiveIndicators";
import { router } from "@/app/router";
import { cn, truncateHandle } from "@/lib/utils";

/**
 * Persistent call presence (T-14/T3). Mounted OUTSIDE the router (main.tsx),
 * so it survives every navigation, and keeps a RoomAudioRenderer mounted so
 * remote audio keeps playing on every route.
 *
 * While a call is live and you're anywhere but the call page, a draggable
 * mini-call window stays on screen: live video (screenshare > camera >
 * avatars), controls, click-to-return. The call is never invisible.
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

  // Draggable position (null → default bottom-right corner).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const grip = useRef<{ dx: number; dy: number } | null>(null);
  // True after a real drag - swallows the click that fires on release so
  // dropping the window doesn't ALSO navigate back to the call.
  const dragged = useRef(false);
  const startDrag = (e: React.PointerEvent) => {
    const card = (e.currentTarget as HTMLElement).closest("[data-minicall]") as HTMLElement | null;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    grip.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      if (!grip.current) return;
      if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 5) dragged.current = true;
      if (!dragged.current) return; // ignore micro-jitter: stay a click
      setPos({
        x: Math.min(Math.max(8, ev.clientX - grip.current.dx), window.innerWidth - rect.width - 8),
        y: Math.min(Math.max(8, ev.clientY - grip.current.dy), window.innerHeight - 96),
      });
    };
    const up = () => {
      grip.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // Let the click event (which fires after pointerup) see dragged=true,
      // then reset for the next interaction.
      setTimeout(() => {
        dragged.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  if (status === "idle" || !room || !target) return null;
  const onCallPage = path === callPath(target);

  return (
    <RoomContext.Provider value={room}>
      {/* THE single remote-audio renderer for the whole call. CallDock is
          mounted outside the router (main.tsx), so this never unmounts during
          a call regardless of navigation - exactly one renderer, always, on
          every page including the call page. (CallStage no longer renders its
          own; two renderers = every track played twice = echo.) */}
      <RoomAudioRenderer />
      <PipBridge />
      {!onCallPage && (
        <div
          data-minicall
          onPointerDown={startDrag}
          className="fixed z-50 w-72 max-w-[calc(100vw-16px)] cursor-move select-none overflow-hidden rounded-card border border-line bg-paper font-stack shadow-[var(--st-shadow-card)] active:cursor-grabbing max-sm:w-60"
          style={pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 16 }}
          onClickCapture={(e) => {
            if (dragged.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {/* Status row + return-to-call */}
          <div className="flex items-center gap-2 px-3 py-2">
            <LiveBars />
            <button
              onClick={() => void router.navigate(callPath(target))}
              title="Return to call"
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <span className="block truncate text-[12.5px] font-semibold text-ink">
                {target.kind === "channel" ? `#${target.label}` : target.label}
              </span>
              <span className="block text-[10.5px] text-ink-faint">
                {status === "connected" ? "in call · click to return" : "connecting…"}
              </span>
            </button>
          </div>
          {/* Live picture - click returns to the call */}
          <button
            onClick={() => void router.navigate(callPath(target))}
            title="Return to call"
            className="block aspect-video w-full cursor-pointer bg-[#101014]"
          >
            <MiniStage />
          </button>
          <div className="flex items-center justify-center gap-1 p-1.5 [&_button]:cursor-pointer">
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
                className="ml-1 grid h-8 w-11 place-items-center rounded-control bg-negative text-white transition-opacity hover:opacity-90"
              >
                <PhoneOff className="size-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </RoomContext.Provider>
  );
}

/**
 * System-level Picture-in-Picture (T4): when the browser itself is
 * backgrounded mid-call, pop the primary video into a native floating window
 * over whatever's on screen (Meet/Discord-style). Safari auto-enters via the
 * `autoPictureInPicture` attribute; Chrome auto-enters for video-call sites
 * that register the mediaSession "enterpictureinpicture" handler; a
 * visibilitychange fallback covers manual cases. Muted - RoomAudioRenderer
 * is the one audio path.
 */
function PipBridge() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const refs = tracks.filter(isTrackReference);
  const show =
    refs.find((t) => t.source === Track.Source.ScreenShare) ??
    refs.find((t) => t.source === Track.Source.Camera && !t.publication.isMuted);

  useEffect(() => {
    const el = videoRef.current;
    const track = show?.publication.track;
    if (!el || !track) return;
    track.attach(el);
    (el as HTMLVideoElement & { autoPictureInPicture?: boolean }).autoPictureInPicture = true; // Safari
    return () => {
      track.detach(el);
    };
  }, [show]);

  useEffect(() => {
    // Chrome: registering this handler opts the site into automatic PiP when
    // the tab is hidden during a call.
    try {
      navigator.mediaSession?.setActionHandler?.("enterpictureinpicture" as MediaSessionAction, () => {
        void videoRef.current?.requestPictureInPicture().catch(() => {});
      });
    } catch {
      /* unsupported */
    }
    const onVis = () => {
      const el = videoRef.current;
      if (!el || !el.srcObject) return;
      if (document.visibilityState === "hidden" && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
        void el.requestPictureInPicture().catch(() => {});
      } else if (document.visibilityState === "visible" && document.pictureInPictureElement === el) {
        void document.exitPictureInPicture().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        navigator.mediaSession?.setActionHandler?.("enterpictureinpicture" as MediaSessionAction, null);
      } catch {
        /* unsupported */
      }
    };
  }, []);

  if (!show) return null;
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      aria-hidden
      className="pointer-events-none fixed bottom-0 right-0 h-px w-px opacity-0"
    />
  );
}

/** Mini live view: screenshare first, then any live camera, else avatars. */
function MiniStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const refs = tracks.filter(isTrackReference);
  const show =
    refs.find((t) => t.source === Track.Source.ScreenShare) ??
    refs.find((t) => t.source === Track.Source.Camera && !t.publication.isMuted);
  const participants = useParticipants();

  if (show) return <VideoTrack trackRef={show} className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full items-center justify-center gap-2">
      {participants.slice(0, 5).map((p) => {
        const handle = p.identity.split("#")[0];
        return (
          <UserAvatar
            key={p.identity}
            name={p.name || truncateHandle(handle, 6, 3)}
            id={handle}
            className="!size-10 !rounded-full !text-[13px]"
          />
        );
      })}
    </div>
  );
}

/**
 * In-sidebar call panel (Discord's "voice connected" block). Pinned above the
 * bottom of both sidebars while a call is live: status row navigates back to
 * the call, controls row below. Renders nothing when no call is active.
 * Audio is NOT handled here - CallDock's renderer covers every route.
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
        <LiveBars />
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

function DockBtn({
  label,
  active,
  wide,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  /** Stretch to fill a grid cell (sidebar panel) instead of the fixed size. */
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
