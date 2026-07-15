import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Per-user call volume preferences (T3), keyed by Gossip handle so they
 * stick across calls and sessions (like Discord's per-user volume). `mic`
 * is the person's voice, `screen` their screenshare audio; 0..2 (gain > 1
 * boosts quiet mics via LiveKit's WebAudio mix). `muted` silences their
 * voice for you without touching the saved level.
 */
export const MAX_VOLUME = 2; // 200%

interface UserVolumes {
  mic?: number;
  screen?: number;
  muted?: boolean;
}

interface CallVolumesState {
  volumes: Record<string, UserVolumes>;
  setVolume: (handle: string, kind: "mic" | "screen", value: number) => void;
  setMuted: (handle: string, muted: boolean) => void;
}

export const useCallVolumes = create<CallVolumesState>()(
  persist(
    (set) => ({
      volumes: {},
      setVolume: (handle, kind, value) =>
        set((s) => ({
          volumes: {
            ...s.volumes,
            [handle]: { ...s.volumes[handle], [kind]: Math.min(MAX_VOLUME, Math.max(0, value)) },
          },
        })),
      setMuted: (handle, muted) =>
        set((s) => ({
          volumes: { ...s.volumes, [handle]: { ...s.volumes[handle], muted } },
        })),
    }),
    { name: "gossip-call-volumes" },
  ),
);

/** The volume actually applied for someone's voice (mute wins). */
export function effectiveMicVolume(v: UserVolumes | undefined): number {
  if (v?.muted) return 0;
  return v?.mic ?? 1;
}
