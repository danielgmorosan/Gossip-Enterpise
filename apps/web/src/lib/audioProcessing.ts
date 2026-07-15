import { Track, type Room, type LocalAudioTrack } from "livekit-client";
import type { AudioProcessorOptions, TrackProcessor } from "livekit-client";
import { useAdvancedAudio } from "@/stores/useAdvancedAudio";

/**
 * Advanced audio (T-15): a LiveKit TrackProcessor that pipes the mic through
 * a Web Audio graph - getUserMedia track → AudioWorklet noise gate + gain →
 * MediaStreamDestination → published track. VAD state from the worklet lands
 * in the useAdvancedAudio store (dock/settings indicators).
 */
type AudioTrackProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>;

interface GateHandle {
  processor: AudioTrackProcessor;
  update: (params: { thresholdDb?: number; gainDb?: number }) => void;
}

let active: GateHandle | null = null;

function createNoiseGate(initial: { thresholdDb: number; gainDb: number }): GateHandle {
  let node: AudioWorkletNode | null = null;
  let src: MediaStreamAudioSourceNode | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;

  const setUp = async (opts: AudioProcessorOptions) => {
    const ctx = opts.audioContext;
    await ctx.audioWorklet.addModule("/worklets/noise-gate.worklet.js");
    src = ctx.createMediaStreamSource(new MediaStream([opts.track]));
    node = new AudioWorkletNode(ctx, "noise-gate", { processorOptions: initial });
    node.port.onmessage = (e) => {
      const d = e.data as { speaking: boolean; levelDb: number };
      useAdvancedAudio.setState({ speaking: d.speaking, levelDb: d.levelDb });
    };
    dest = ctx.createMediaStreamDestination();
    src.connect(node).connect(dest);
    handle.processor.processedTrack = dest.stream.getAudioTracks()[0];
  };

  const tearDown = async () => {
    try {
      src?.disconnect();
      node?.disconnect();
      handle.processor.processedTrack?.stop();
    } catch {
      /* graph already gone */
    }
    node = null;
    src = null;
    dest = null;
    useAdvancedAudio.setState({ speaking: false, levelDb: -100 });
  };

  const handle: GateHandle = {
    update: (params) => node?.port.postMessage(params),
    processor: {
      name: "noise-gate",
      init: setUp,
      restart: async (opts) => {
        await tearDown();
        await setUp(opts);
      },
      destroy: tearDown,
    },
  };
  return handle;
}

function micTrack(room: Room): LocalAudioTrack | undefined {
  return room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack as
    | LocalAudioTrack
    | undefined;
}

/** Attach (or detach) the gate to the room's mic track per current settings. */
export async function syncNoiseGate(room: Room): Promise<void> {
  const { enabled, thresholdDb, gainDb } = useAdvancedAudio.getState();
  const track = micTrack(room);
  if (!track) return;
  if (enabled && !active) {
    active = createNoiseGate({ thresholdDb, gainDb });
    await track.setProcessor(active.processor);
  } else if (!enabled && active) {
    await track.stopProcessor();
    active = null;
  }
}

/** Live param update while a call is running (no reconnect needed). */
export function updateNoiseGate(params: { thresholdDb?: number; gainDb?: number }): void {
  active?.update(params);
}

/** Forget the handle after a call ends (tracks are already stopped). */
export function resetNoiseGate(): void {
  active = null;
  useAdvancedAudio.setState({ speaking: false, levelDb: -100 });
}
