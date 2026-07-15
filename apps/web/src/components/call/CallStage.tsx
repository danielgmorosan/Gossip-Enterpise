import { useEffect, useState, type ReactNode } from "react";
import { Track, RemoteParticipant, type Participant } from "livekit-client";
import {
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useIsMuted,
  useIsSpeaking,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, MessageSquareText, VolumeX, X } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { UserAvatar } from "@/components/UserAvatar";
import { useCall, type CallTarget } from "@/stores/useCall";
import { ChannelView } from "@/pages/ChannelView";
import { RealDmView } from "@/components/chat/RealDmView";
import { ParticipantMenu } from "./ParticipantMenu";
import { useCallVolumes } from "@/stores/useCallVolumes";
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
  const screenAudioMissing = useCall((s) => s.screenAudioMissing);
  const { toggleMic, toggleCam, toggleScreen, leave } = useCall.getState();
  const [chatOpen, setChatOpen] = useState(true);
  // Right-click volume menu (T3): { cursor position, whose audio }.
  const [menu, setMenu] = useState<{ x: number; y: number; participant: Participant } | null>(null);
  const openMenu = (e: React.MouseEvent, participant: Participant) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, participant });
  };

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
          <div
            className={cn("min-h-0 p-3 pb-0", chatOpen ? "h-[38vh]" : "min-h-[38vh] flex-1")}
            onContextMenu={(e) => openMenu(e, screenShare.participant)}
            title="Right-click for volume"
          >
            <VideoTrack trackRef={screenShare} className="h-full w-full rounded-card object-contain" />
          </div>
        )}
        <div className="flex max-h-[38vh] shrink-0 flex-wrap items-center justify-center gap-2 overflow-y-auto px-4 py-3">
          {cameras.map((t) => (
            <ParticipantCard key={`${t.participant.identity}:${t.source}`} trackRef={t} large={large} onMenu={openMenu} />
          ))}
        </div>
      </div>

      {menu && <ParticipantMenu x={menu.x} y={menu.y} participant={menu.participant} onClose={() => setMenu(null)} />}

      {/* Sharer-side heads-up: this share carries NO audio (browser/picker
          choice) — better than mystery silence on the other end (T3). */}
      {screenAudioMissing && (
        <div className="flex shrink-0 items-center gap-2.5 border-t border-line bg-paper-2 px-4 py-2 text-[12.5px] text-ink-mute">
          <VolumeX className="size-4 shrink-0 text-negative" />
          <span className="min-w-0">
            <span className="font-semibold text-ink">Your share has no sound.</span>{" "}
            To include audio: share a <span className="font-medium text-ink">browser tab</span> and tick “Also share tab
            audio”, or your entire screen with “Share system audio”. Window shares — and Firefox — can't capture audio.
          </span>
          <button
            onClick={() => useCall.getState().dismissScreenAudioHint()}
            aria-label="Dismiss"
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

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

      {/* The REAL conversation, not a mini copy (T3): full ChannelView / DM
          view docked under the call — links, previews, threads, attachments,
          edit/delete all behave exactly like on the normal page. */}
      {chatOpen && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-line">
          {target.kind === "channel" ? (
            <ChannelView embedded />
          ) : (
            <RealDmView peerId={target.peerId} peerName={target.label} embedded />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Fixed-size 16:9 participant tile. Camera on fills the tile with video;
 * camera off shows a small circular avatar — never a tile-sized silhouette.
 * Speaking gets the green ring; a muted mic is flagged in the name chip.
 * Right-click opens the per-user volume menu (T3).
 */
function ParticipantCard({
  trackRef,
  large,
  onMenu,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  large: boolean;
  onMenu?: (e: React.MouseEvent, participant: Participant) => void;
}) {
  const p = trackRef.participant;
  const speaking = useIsSpeaking(p);
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone });
  const camMuted = useIsMuted(trackRef);
  // Identity carries a per-connection suffix (duplicate-kick fix) — strip it
  // so avatars and handles resolve to the real user.
  const handle = p.identity.split("#")[0];
  const name = p.name || truncateHandle(handle, 8, 4);

  // Apply this listener's saved volume prefs for this person (T3) — voice and
  // screenshare audio. Re-applied when prefs change or their tracks appear.
  const vol = useCallVolumes((s) => s.volumes[handle]);
  const sharingAudio = !!p.getTrackPublication(Track.Source.ScreenShareAudio);
  useEffect(() => {
    if (!(p instanceof RemoteParticipant)) return;
    p.setVolume(vol?.mic ?? 1);
    if (sharingAudio) p.setVolume(vol?.screen ?? 1, Track.Source.ScreenShareAudio);
  }, [p, vol, sharingAudio]);

  return (
    <div
      onContextMenu={(e) => onMenu?.(e, p)}
      title="Right-click for volume"
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
            id={handle}
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
