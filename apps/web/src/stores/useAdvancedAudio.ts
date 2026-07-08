import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Advanced audio processing prefs (T-15): noise gate threshold + output gain.
 * `enabled/thresholdDb/gainDb` persist; `speaking/levelDb` are live VAD state
 * fed by the worklet during a call (never persisted).
 */
interface AdvancedAudioState {
  enabled: boolean;
  /** Gate threshold in dBFS — signal below this is silenced. */
  thresholdDb: number;
  /** Post-gate gain in dB. */
  gainDb: number;
  /** Live voice-activity state (runtime only). */
  speaking: boolean;
  levelDb: number;
  set: (patch: Partial<Pick<AdvancedAudioState, "enabled" | "thresholdDb" | "gainDb">>) => void;
}

export const useAdvancedAudio = create<AdvancedAudioState>()(
  persist(
    (set) => ({
      enabled: false,
      thresholdDb: -45,
      gainDb: 0,
      speaking: false,
      levelDb: -100,
      set: (patch) => set(patch),
    }),
    {
      name: "gossip-advanced-audio",
      partialize: (s) => ({ enabled: s.enabled, thresholdDb: s.thresholdDb, gainDb: s.gainDb }),
    },
  ),
);
