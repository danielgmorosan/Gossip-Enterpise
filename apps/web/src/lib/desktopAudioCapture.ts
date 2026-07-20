// Screenshare audio: turn the desktop shell's native PCM stream into a
// MediaStreamTrack we publish as ScreenShareAudio — instead of getDisplayMedia's
// system-audio loopback, which re-broadcasts the call playback and causes echo.
// See docs/screenshare-audio.md. Phase 1 is fed by a test tone from the shell.

interface AudioCaptureBridge {
  start: () => Promise<{ sampleRate: number; channels: number }>;
  stop: () => Promise<boolean>;
  onFrame: (cb: (pcm: ArrayBuffer) => void) => () => void;
}

function bridge(): AudioCaptureBridge | null {
  const w = window as unknown as { umbryDesktop?: { audioCapture?: AudioCaptureBridge } };
  return w.umbryDesktop?.audioCapture ?? null;
}

/** True when the desktop shell can supply screenshare audio natively. */
export function canCaptureDesktopAudio(): boolean {
  return bridge() != null;
}

export interface DesktopAudioCapture {
  track: MediaStreamTrack;
  stop: () => void;
}

/**
 * Start the native audio pipeline and return a live MediaStreamTrack. Returns
 * null when not in the desktop shell (caller falls back to no share audio).
 */
export async function startDesktopShareAudio(): Promise<DesktopAudioCapture | null> {
  const b = bridge();
  if (!b) return null;

  const { sampleRate } = await b.start();
  const ctx = new AudioContext({ sampleRate });
  try {
    await ctx.audioWorklet.addModule("/pcm-ring-worklet.js");
  } catch (e) {
    await ctx.close().catch(() => {});
    void b.stop();
    throw e;
  }

  const node = new AudioWorkletNode(ctx, "pcm-ring", { outputChannelCount: [2] });
  const dest = ctx.createMediaStreamDestination();
  node.connect(dest);

  // Feed native PCM chunks straight into the worklet (transfer, no copy).
  const unsub = b.onFrame((pcm) => {
    node.port.postMessage(pcm, [pcm]);
  });

  const track = dest.stream.getAudioTracks()[0];
  if (!track) {
    unsub();
    void b.stop();
    await ctx.close().catch(() => {});
    return null;
  }

  const stop = () => {
    unsub();
    void b.stop();
    try {
      node.port.postMessage("flush");
      node.disconnect();
    } catch {
      /* already torn down */
    }
    track.stop();
    void ctx.close().catch(() => {});
  };

  return { track, stop };
}
