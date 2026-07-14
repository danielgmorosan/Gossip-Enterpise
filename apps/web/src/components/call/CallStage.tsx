import { useState, type ReactNode } from "react";
import { Track } from "livekit-client";
import { GridLayout, ParticipantTile, RoomAudioRenderer, useTracks } from "@livekit/components-react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, MessageSquareText } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { useCall, type CallTarget } from "@/stores/useCall";
import { CallChatPanel } from "./CallChatPanel";
import { cn } from "@/lib/utils";

/**
 * Custom in-call surface (T2-06) — replaces LiveKit's prefab VideoConference.
 * GridLayout + ParticipantTile keep LiveKit's responsive tile grid, speaking
 * ring, and mute badges (scoped under data-lk-theme), while the control bar
 * is ours: Stack tokens, so buttons read correctly in dark mode. A text-chat
 * panel (channel or E2E DM) docks on the right.
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {/* Remote audio for the call surface (the CallDock's renderer is off on this page). */}
      <RoomAudioRenderer />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Tile grid — capped width so 1:1 calls don't become a wall of video. */}
        <div className="min-h-0 flex-1 bg-paper-2 p-3" data-lk-theme="default">
          <div className={cn("mx-auto h-full w-full", tracks.length <= 2 ? "max-w-3xl" : "max-w-5xl")}>
            <GridLayout tracks={tracks} style={{ height: "100%" }}>
              <ParticipantTile />
            </GridLayout>
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
      </div>

      {chatOpen && <CallChatPanel target={target} onClose={() => setChatOpen(false)} />}
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
