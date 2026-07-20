/**
 * Screenshare audio capture — the main-process source (see docs/screenshare-audio.md).
 *
 * Prefers the native Windows process-loopback capturer (native/loopback), which
 * captures system audio EXCLUDING Umbry's own process tree — so the call playback
 * isn't recaptured and there's no echo. Streams its PCM to the renderer, which
 * turns it into a MediaStreamTrack (desktopAudioCapture.ts) published as
 * ScreenShareAudio instead of getDisplayMedia's echoing systemAudio loopback.
 *
 * Falls back to a 440 Hz TEST TONE when the native exe isn't present (e.g. a dev
 * run before it's built), so the pipeline is still exercisable. Format either
 * way: interleaved Float32 stereo at 48 kHz.
 */
import { ipcMain, app, type WebContents } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_BYTES = CHANNELS * 4; // one interleaved stereo frame (Float32)

let helper: ChildProcessWithoutNullStreams | null = null;
let toneTimer: ReturnType<typeof setInterval> | null = null;

// ── Native capturer ──────────────────────────────────────────────────────────
function helperPath(): string | null {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, "loopback.exe") : "",
    path.join(__dirname, "..", "native", "loopback", "loopback.exe"),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function startNative(wc: WebContents): boolean {
  if (process.platform !== "win32") return false;
  const bin = helperPath();
  if (!bin) return false;
  try {
    // Exclude our own process tree so the call playback isn't recaptured.
    helper = spawn(bin, ["--pid", String(process.pid), "--mode", "exclude"], { windowsHide: true });
  } catch {
    helper = null;
    return false;
  }

  // stdout arrives in arbitrary byte chunks; forward only whole stereo frames and
  // carry the remainder so we never split a sample across messages.
  let leftover = Buffer.alloc(0);
  helper.stdout.on("data", (buf: Buffer) => {
    if (!wc || wc.isDestroyed()) return;
    const data = leftover.length ? Buffer.concat([leftover, buf]) : buf;
    const usable = data.length - (data.length % FRAME_BYTES);
    if (usable > 0) {
      const view = data.subarray(0, usable);
      // Copy into a fresh, 4-byte-aligned ArrayBuffer for Float32Array/transfer.
      const ab = view.buffer.slice(view.byteOffset, view.byteOffset + usable);
      wc.send("umbry:audio:frame", ab);
    }
    leftover = Buffer.from(data.subarray(usable)); // detach from the pooled buffer
  });
  helper.stderr.on("data", (b: Buffer) => {
    if (!app.isPackaged) process.stderr.write(`[loopback] ${b}`);
  });
  helper.on("error", () => stopNative());
  helper.on("exit", () => {
    helper = null;
  });
  return true;
}

function stopNative(): void {
  if (helper) {
    try {
      helper.kill();
    } catch {
      /* already gone */
    }
    helper = null;
  }
}

// ── Test-tone fallback (dev, when the native exe isn't built) ─────────────────
function startTone(wc: WebContents): void {
  const CHUNK_MS = 20;
  const framesPerChunk = (SAMPLE_RATE * CHUNK_MS) / 1000;
  let phase = 0;
  const step = (2 * Math.PI * 440) / SAMPLE_RATE;
  toneTimer = setInterval(() => {
    if (!wc || wc.isDestroyed()) return;
    const pcm = new Float32Array(framesPerChunk * CHANNELS);
    for (let i = 0; i < framesPerChunk; i++) {
      const s = Math.sin(phase) * 0.15;
      phase += step;
      if (phase > Math.PI) phase -= 2 * Math.PI;
      pcm[i * CHANNELS] = s;
      pcm[i * CHANNELS + 1] = s;
    }
    wc.send("umbry:audio:frame", pcm.buffer);
  }, CHUNK_MS);
}

function stopTone(): void {
  if (toneTimer) {
    clearInterval(toneTimer);
    toneTimer = null;
  }
}

/** Register the capture IPC. `getWC` resolves the renderer to stream frames to. */
export function setupAudioCapture(getWC: () => WebContents | null): void {
  ipcMain.handle("umbry:audio:start", () => {
    stopNative();
    stopTone();
    const wc = getWC();
    let source: "native" | "tone" | "none" = "none";
    if (wc && startNative(wc)) source = "native";
    else if (wc && !app.isPackaged) {
      startTone(wc); // dev pipeline check when the native exe isn't built yet
      source = "tone";
    }
    return { sampleRate: SAMPLE_RATE, channels: CHANNELS, source };
  });

  ipcMain.handle("umbry:audio:stop", () => {
    stopNative();
    stopTone();
    return true;
  });
}
