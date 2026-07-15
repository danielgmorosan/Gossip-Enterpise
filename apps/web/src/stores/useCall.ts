import { DisconnectReason, Room, RoomEvent, Track, type RoomOptions } from "livekit-client";
import { create } from "zustand";
import { syncNoiseGate, resetNoiseGate } from "@/lib/audioProcessing";
import { playJoinBlip, playLeaveBlip, playCallEnd } from "@/lib/sounds";
import { useAudioSettings } from "@/stores/useAudioSettings";

// Reloading mid-call would silently drop the call - ask first (browsers show
// their own generic wording; registering the handler is what arms the prompt).
function guardUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}

/**
 * Global call session (T-14). The LiveKit `Room` lives HERE - module scope,
 * above the router - so navigating between channels/DMs/settings never
 * unmounts the media session. Route components only render UI bound to it
 * via RoomContext; the persistent CallDock (mounted beside the router in
 * main.tsx) keeps remote audio playing and offers controls everywhere.
 *
 * Exactly one active session: connecting to a new target tears the previous
 * room down first.
 */
export type CallTarget =
  | { kind: "channel"; workspaceId: string; channelId: string; label: string }
  | { kind: "dm"; peerId: string; label: string };

export function callPath(t: CallTarget): string {
  return t.kind === "channel"
    ? `/w/${t.workspaceId}/call/${t.channelId}`
    : `/home/call/dm/${encodeURIComponent(t.peerId)}`;
}

export function sameTarget(a: CallTarget | null, b: CallTarget | null): boolean {
  return !!a && !!b && callPath(a) === callPath(b);
}

interface CallState {
  room: Room | null;
  status: "idle" | "connecting" | "connected";
  target: CallTarget | null;
  mic: boolean;
  cam: boolean;
  screen: boolean;
  /** Sharing without an audio track - the browser/picker choice gave no sound (T3 hint). */
  screenAudioMissing: boolean;
  dismissScreenAudioHint: () => void;
  /** Why the last session ended (server kick, duplicate identity, …); null after a user-initiated leave. */
  lastDisconnectReason: DisconnectReason | null;

  connect: (args: { url: string; token: string; target: CallTarget; options: RoomOptions; withVideo?: boolean }) => Promise<void>;
  /** Refresh the display label once the channel/contact name resolves (T3). */
  setTargetLabel: (label: string) => void;
  leave: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  toggleScreen: () => Promise<void>;
  /** Switch the active mic/speaker/camera live during a call (T3, Discord-style). */
  switchDevice: (kind: MediaDeviceKind, deviceId: string) => Promise<void>;
}

export const useCall = create<CallState>((set, get) => {
  const syncLocal = () => {
    const p = get().room?.localParticipant;
    if (!p) return;
    set({ mic: p.isMicrophoneEnabled, cam: p.isCameraEnabled, screen: p.isScreenShareEnabled });
  };

  return {
    room: null,
    status: "idle",
    target: null,
    mic: false,
    cam: false,
    screen: false,
    screenAudioMissing: false,
    dismissScreenAudioHint: () => set({ screenAudioMissing: false }),
    lastDisconnectReason: null,

    connect: async ({ url, token, target, options, withVideo }) => {
      const cur = get();
      // Idempotent for the same target (also absorbs StrictMode double-effects).
      if (cur.status !== "idle" && sameTarget(cur.target, target)) return;
      // Exactly one active session - leave the old call before joining a new one.
      if (cur.room) await get().leave();

      const room = new Room(options);
      set({ room, status: "connecting", target, lastDisconnectReason: null });
      window.addEventListener("beforeunload", guardUnload);
      room
        .on(RoomEvent.LocalTrackPublished, syncLocal)
        .on(RoomEvent.LocalTrackUnpublished, syncLocal)
        .on(RoomEvent.TrackMuted, syncLocal)
        .on(RoomEvent.TrackUnmuted, syncLocal)
        .on(RoomEvent.ParticipantConnected, playJoinBlip)
        .on(RoomEvent.ParticipantDisconnected, playLeaveBlip)
        .on(RoomEvent.Disconnected, (reason) => {
          // Covers every path out: dock Leave, in-call leave button, server kick.
          if (reason !== undefined && reason !== DisconnectReason.CLIENT_INITIATED) {
            console.warn("[call] disconnected by server, reason:", DisconnectReason[reason] ?? reason);
          }
          if (get().room === room) {
            set({
              room: null,
              status: "idle",
              target: null,
              mic: false,
              cam: false,
              screen: false,
              screenAudioMissing: false,
              lastDisconnectReason: reason ?? null,
            });
            resetNoiseGate();
            window.removeEventListener("beforeunload", guardUnload);
            playCallEnd();
          }
        });
      try {
        await room.connect(url, token);
        // Voice call: mic only (no intrusive camera prompt). Video call: also
        // turn the camera on at join (T3). Either way the user can toggle.
        await room.localParticipant.setMicrophoneEnabled(true);
        if (withVideo) {
          try {
            await room.localParticipant.setCameraEnabled(true);
          } catch {
            /* camera denied - stay voice-only */
          }
        }
        // Only flip to connected if this room is still current (no race with leave()).
        if (get().room === room) {
          set({ status: "connected" });
          syncLocal();
          // T-15: attach the noise-gate processor if enabled in settings.
          try {
            await syncNoiseGate(room);
          } catch (e) {
            console.error("noise gate attach failed", e);
          }
        }
      } catch (e) {
        try {
          await room.disconnect();
        } catch {
          /* already down */
        }
        if (get().room === room) {
          set({ room: null, status: "idle", target: null, mic: false, cam: false, screen: false, screenAudioMissing: false });
        }
        throw e;
      }
    },

    setTargetLabel: (label) => {
      const t = get().target;
      if (t && label && t.label !== label) set({ target: { ...t, label } });
    },

    leave: async () => {
      const room = get().room;
      const target = get().target;
      const wasAlone = !!room && room.remoteParticipants.size === 0;
      set({ room: null, status: "idle", target: null, mic: false, cam: false, screen: false, screenAudioMissing: false });
      resetNoiseGate();
      window.removeEventListener("beforeunload", guardUnload);
      if (room) {
        playCallEnd();
        try {
          await room.disconnect(); // stops all local tracks - mic light goes off
        } catch {
          /* already down */
        }
        // Last one out: flip the "call in progress" state immediately instead
        // of waiting for the relay's next LiveKit reconciliation.
        if (wasAlone && target?.kind === "channel") {
          const { useRelay } = await import("./useRelay");
          useRelay.getState().callEndedHint(target.workspaceId, target.channelId);
        }
      }
    },

    toggleMic: async () => {
      const r = get().room;
      if (!r) return;
      await r.localParticipant.setMicrophoneEnabled(!get().mic);
      syncLocal();
    },
    toggleCam: async () => {
      const r = get().room;
      if (!r) return;
      await r.localParticipant.setCameraEnabled(!get().cam);
      syncLocal();
    },
    switchDevice: async (kind, deviceId) => {
      const r = get().room;
      if (!r) return;
      try {
        await r.switchActiveDevice(kind, deviceId);
      } catch (e) {
        console.error("switchActiveDevice failed", e);
      }
      // Persist so the choice sticks for the next call too.
      const audio = useAudioSettings.getState();
      if (kind === "audioinput") audio.set({ inputId: deviceId });
      else if (kind === "audiooutput") audio.set({ outputId: deviceId });
      syncLocal();
    },

    toggleScreen: async () => {
      const r = get().room;
      if (!r) return;
      const enabling = !get().screen;
      try {
        // audio: true → the browser's share picker offers "also share audio"
        // (tab audio anywhere; system audio on Windows when sharing a screen).
        // Without it the picker never even shows the checkbox.
        await r.localParticipant.setScreenShareEnabled(enabling, {
          audio: true,
          // Let people share the Gossip tab itself (demos) instead of hiding it.
          selfBrowserSurface: "include",
          // Windows Chrome: pre-tick the "share system audio" option for screen shares.
          systemAudio: "include",
        });
      } catch {
        // User cancelled the share picker - not an error.
      }
      syncLocal();
      // Sharing but no audio track came with it (window share, unchecked box,
      // or Firefox - which can't capture display audio at all): tell the
      // sharer, so silence isn't a mystery on the other end.
      const sharingNow = get().screen;
      const hasShareAudio = !!r.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
      set({ screenAudioMissing: sharingNow && !hasShareAudio });
    },
  };
});
