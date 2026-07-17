import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Call video preferences (T4): camera capture quality and screen-share
 * resolution/framerate/priority. Persisted locally; camera settings apply on
 * the next call join (LiveKit videoCaptureDefaults), share settings apply the
 * next time a share starts (capture options in useCall.toggleScreen).
 */
export type CamPreset = "auto" | "1080" | "720" | "360";
export type ShareRes = "source" | "1080" | "720";
export type ShareFps = 5 | 15 | 30 | 60;

interface VideoSettingsState {
  camPreset: CamPreset;
  shareRes: ShareRes;
  shareFps: ShareFps;
  /** What the share encode optimizes for: crisp text or smooth motion. */
  sharePrioritize: "detail" | "motion";
  set: (patch: Partial<Omit<VideoSettingsState, "set">>) => void;
}

export const useVideoSettings = create<VideoSettingsState>()(
  persist(
    (set) => ({
      camPreset: "auto",
      shareRes: "source",
      shareFps: 30,
      sharePrioritize: "detail",
      set: (patch) => set(patch),
    }),
    { name: "gossip-video-settings" },
  ),
);
