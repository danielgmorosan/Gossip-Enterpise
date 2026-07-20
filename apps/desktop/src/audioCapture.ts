/**
 * Screenshare audio capture — the main-process source (see docs/screenshare-audio.md).
 *
 * PHASE 1: a synthetic 440 Hz test tone, so we can prove the full pipeline end to
 * end — main → IPC → renderer AudioWorklet → MediaStreamTrack → LiveKit publish —
 * BEFORE writing any native capture code. When a remote participant hears the
 * tone as "screenshare audio" (and does NOT hear the echo of their own voice),
 * the spine works and Phase 2 swaps this generator for the real native,
 * process-excluded capture engine (ScreenCaptureKit / WASAPI process-loopback).
 *
 * Format: interleaved Float32 stereo at 48 kHz, 20 ms chunks (what Web Audio and
 * WebRTC want). ArrayBuffers are sent over the standard IPC channel — fine for
 * one stereo stream (~384 KB/s); Phase 2 can move to a dedicated MessagePort if
 * the real capture needs lower latency.
 */
import { ipcMain, type WebContents } from "electron";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const CHUNK_MS = 20;
const FRAMES_PER_CHUNK = (SAMPLE_RATE * CHUNK_MS) / 1000; // 960

let timer: ReturnType<typeof setInterval> | null = null;
let phase = 0;

function stop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Register the capture IPC. `getWC` resolves the renderer to stream frames to. */
export function setupAudioCapture(getWC: () => WebContents | null): void {
  ipcMain.handle("umbry:audio:start", () => {
    stop();
    phase = 0;
    const freq = 440;
    const step = (2 * Math.PI * freq) / SAMPLE_RATE;
    timer = setInterval(() => {
      const wc = getWC();
      if (!wc || wc.isDestroyed()) return;
      const pcm = new Float32Array(FRAMES_PER_CHUNK * CHANNELS);
      for (let i = 0; i < FRAMES_PER_CHUNK; i++) {
        const s = Math.sin(phase) * 0.15; // -16 dBFS, gentle
        phase += step;
        if (phase > Math.PI) phase -= 2 * Math.PI;
        pcm[i * CHANNELS] = s;
        pcm[i * CHANNELS + 1] = s;
      }
      wc.send("umbry:audio:frame", pcm.buffer);
    }, CHUNK_MS);
    return { sampleRate: SAMPLE_RATE, channels: CHANNELS };
  });

  ipcMain.handle("umbry:audio:stop", () => {
    stop();
    return true;
  });
}
