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
  /** Camera background effect (T4): none, blur, or a custom image. */
  background: "none" | "blur" | "image";
  /** Compressed data-URI of the custom background image. */
  backgroundImage: string;
  set: (patch: Partial<Omit<VideoSettingsState, "set">>) => void;
}

export const useVideoSettings = create<VideoSettingsState>()(
  persist(
    (set) => ({
      camPreset: "auto",
      // 1080/30 by default, not "source": capturing a Retina panel at its
      // native size (up to 4K) and encoding it without ever downscaling pins
      // the CPU. Users who want native crispness can still pick "source".
      shareRes: "1080",
      shareFps: 30,
      sharePrioritize: "detail",
      background: "none",
      backgroundImage: "",
      set: (patch) => set(patch),
    }),
    {
      name: "gossip-video-settings",
      version: 1,
      // v0 shipped with shareRes "source" as the default, which is what made
      // sharing a Retina screen so expensive. Move anyone still on the old
      // default down to 1080; an explicit "source" choice is indistinguishable
      // from the default here, so this is a deliberate one-time reset.
      migrate: (state, from) => {
        const s = state as Partial<VideoSettingsState>;
        if (from < 1 && s.shareRes === "source") s.shareRes = "1080";
        return s as VideoSettingsState;
      },
    },
  ),
);
