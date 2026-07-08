import { Room, RoomEvent, type RoomOptions } from "livekit-client";
import { create } from "zustand";
import { syncNoiseGate, resetNoiseGate } from "@/lib/audioProcessing";

/**
 * Global call session (T-14). The LiveKit `Room` lives HERE — module scope,
 * above the router — so navigating between channels/DMs/settings never
 * unmounts the media session. Route components only render UI bound to it
 * via RoomContext; the persistent CallDock (mounted beside the router in
 * main.tsx) keeps remote audio playing and offers controls everywhere.
 *
 * Exactly one active session: connecting to a new target tears the previous
 * room down first.
 */
export type CallTarget =
  | { kind: "channel"; workspaceId: string; channelId: string; label: string }
  | { kind: "dm"; workspaceId: string; peerId: string; label: string };

export function callPath(t: CallTarget): string {
  return t.kind === "channel"
    ? `/w/${t.workspaceId}/call/${t.channelId}`
    : `/w/${t.workspaceId}/call/dm/${encodeURIComponent(t.peerId)}`;
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

  connect: (args: { url: string; token: string; target: CallTarget; options: RoomOptions }) => Promise<void>;
  leave: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  toggleScreen: () => Promise<void>;
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

    connect: async ({ url, token, target, options }) => {
      const cur = get();
      // Idempotent for the same target (also absorbs StrictMode double-effects).
      if (cur.status !== "idle" && sameTarget(cur.target, target)) return;
      // Exactly one active session — leave the old call before joining a new one.
      if (cur.room) await get().leave();

      const room = new Room(options);
      set({ room, status: "connecting", target });
      room
        .on(RoomEvent.LocalTrackPublished, syncLocal)
        .on(RoomEvent.LocalTrackUnpublished, syncLocal)
        .on(RoomEvent.TrackMuted, syncLocal)
        .on(RoomEvent.TrackUnmuted, syncLocal)
        .on(RoomEvent.Disconnected, () => {
          // Covers every path out: dock Leave, in-call leave button, server kick.
          if (get().room === room) {
            set({ room: null, status: "idle", target: null, mic: false, cam: false, screen: false });
            resetNoiseGate();
          }
        });
      try {
        await room.connect(url, token);
        await room.localParticipant.enableCameraAndMicrophone();
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
          set({ room: null, status: "idle", target: null, mic: false, cam: false, screen: false });
        }
        throw e;
      }
    },

    leave: async () => {
      const room = get().room;
      set({ room: null, status: "idle", target: null, mic: false, cam: false, screen: false });
      resetNoiseGate();
      if (room) {
        try {
          await room.disconnect(); // stops all local tracks — mic light goes off
        } catch {
          /* already down */
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
    toggleScreen: async () => {
      const r = get().room;
      if (!r) return;
      await r.localParticipant.setScreenShareEnabled(!get().screen);
      syncLocal();
    },
  };
});
