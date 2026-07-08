import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Call audio preferences (T-12). Persisted locally; applied to LiveKit rooms
 * via `audioCaptureDefaults` (mic + processing constraints) and `audioOutput`
 * (speaker via setSinkId where the browser supports it).
 */
interface AudioSettingsState {
  /** MediaDeviceInfo.deviceId of the preferred microphone ("" = default). */
  inputId: string;
  /** MediaDeviceInfo.deviceId of the preferred speaker ("" = default). */
  outputId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  set: (patch: Partial<Omit<AudioSettingsState, "set">>) => void;
}

export const useAudioSettings = create<AudioSettingsState>()(
  persist(
    (set) => ({
      inputId: "",
      outputId: "",
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      set: (patch) => set(patch),
    }),
    { name: "gossip-audio-settings" },
  ),
);
