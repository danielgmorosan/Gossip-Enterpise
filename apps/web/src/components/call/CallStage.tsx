import { useState, type ReactNode } from "react";
import { Track } from "livekit-client";
import {
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, MessageSquareText } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { UserAvatar } from "@/components/UserAvatar";
import { useCall, type CallTarget } from "@/stores/useCall";
import { CallChatPanel } from "./CallChatPanel";
import { cn, truncateHandle } from "@/lib/utils";

/**
 * Custom in-call surface (T2-06). Discord-style layout: a dark stage with a
 * compact strip of fixed-size participant tiles (a screenshare gets a large
 * focus area above the strip), the control tray below, and the text chat
 * (channel or E2E DM) docked at the bottom, full-width. The stage stays dark
 * in both themes — video surfaces read as a stage, not a document.
 *
 * Must render inside RoomContext.Provider (the Room lives in useCall, T-14).
 */
export function CallStage({ target }: { target: CallTarget }) {
  const mic = useCall((s) => s.mic);
  const cam = useCall((s) => s.cam);
  const screen = useCall((s) => s.screen);
  const { toggleMic, toggleCam, toggleScreen, leave } = useCall.getState();
  const [chatOpen, setChatOpen] = useState(true);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const screenShare = tracks.filter(isTrackReference).find((t) => t.source === Track.Source.ScreenShare);
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);
  // Tiles grow a bit when they have the room to themselves.
  const large = !chatOpen && !screenShare;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Remote audio for the call surface (the CallDock's renderer is off on this page). */}
      <RoomAudioRenderer />

      <div className={cn("flex min-h-0 flex-col bg-[#101014]", chatOpen ? "shrink-0" : "flex-1 justify-center")}>
        {screenShare && (
          <div className={cn("min-h-0 p-3 pb-0", chatOpen ? "h-[38vh]" : "min-h-[38vh] flex-1")}>
            <VideoTrack trackRef={screenShare} className="h-full w-full rounded-card object-contain" />
          </div>
        )}
        <div className="flex max-h-[38vh] shrink-0 flex-wrap items-center justify-center gap-2 overflow-y-auto px-4 py-3">
          {cameras.map((t) => (
            <ParticipantCard key={`${t.participant.identity}:${t.source}`} trackRef={t} large={large} />
          ))}
        </div>
      </div>

      {/* Control tray — Stack tokens (no white-on-dark blobs in dark mode). */}
      <div className="flex h-16 shrink-0 items-center justify-center gap-2 border-t border-line bg-paper px-4">
        <CallButton label={mic ? "Mute microphone" : "Unmute microphone"} off={!mic} onClick={() => void toggleMic()}>
          {mic ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </CallButton>
        <CallButton label={cam ? "Turn camera off" : "Turn camera on"} off={!cam} onClick={() => void toggleCam()}>
          {cam ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </CallButton>
        <CallButton label={screen ? "Stop sharing" : "Share screen"} active={screen} onClick={() => void toggleScreen()}>
          <MonitorUp className="size-5" />
        </CallButton>
        <CallButton label={chatOpen ? "Hide chat" : "Show chat"} active={chatOpen} onClick={() => setChatOpen((o) => !o)}>
          <MessageSquareText className="size-5" />
        </CallButton>
        <span aria-hidden className="mx-1 h-6 w-px bg-line" />
        <Tooltip label="Leave call">
          <button
            onClick={() => void leave()}
            aria-label="Leave call"
            className="grid h-11 w-14 place-items-center rounded-card bg-negative text-white transition-opacity hover:opacity-90"
          >
            <PhoneOff className="size-5" />
          </button>
        </Tooltip>
      </div>

      {chatOpen && <CallChatPanel target={target} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

/**
 * Fixed-size 16:9 participant tile. Camera on fills the tile with video;
 * camera off shows a small circular avatar — never a tile-sized silhouette.
 * Speaking gets the green ring; a muted mic is flagged in the name chip.
 */
function ParticipantCard({ trackRef, large }: { trackRef: TrackReferenceOrPlaceholder; large: boolean }) {
  const p = trackRef.participant;
  const speaking = useIsSpeaking(p);
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone });
  const camMuted = useIsMuted(trackRef);
  const name = p.name || truncateHandle(p.identity, 8, 4);

  return (
    <div
      className={cn(
        "relative aspect-video shrink-0 overflow-hidden rounded-card bg-[#1b1c22]",
        large ? "w-[300px]" : "w-[216px]",
        speaking && "ring-2 ring-positive",
      )}
    >
      {isTrackReference(trackRef) && !camMuted ? (
        <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <UserAvatar
            name={name}
            id={p.identity}
            className={cn("!rounded-full", large ? "!size-16 !text-[20px]" : "!size-12 !text-[15px]")}
          />
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 rounded-control bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {micMuted && <MicOff className="size-3 shrink-0 text-white/70" />}
        <span className="truncate">{name}</span>
      </span>
    </div>
  );
}

function CallButton({
  label,
  off,
  active,
  onClick,
  children,
}: {
  label: string;
  /** Device explicitly off (mic muted / cam off) — negative fill, Discord-style. */
  off?: boolean;
  /** Feature engaged (screenshare, chat) — inverse fill. */
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-pressed={off === undefined ? active : !off}
        className={cn(
          "grid size-11 place-items-center rounded-card transition-colors",
          off ? "bg-negative text-white hover:opacity-90" : active ? "bg-ink text-paper hover:bg-ink-hover" : "bg-field text-ink hover:bg-line",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
