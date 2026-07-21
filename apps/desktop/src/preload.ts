/**
 * Preload — the ONLY bridge between the hardened renderer and the main process.
 *
 * D1: exposes a tiny, read-only marker so the web app can feature-detect that
 * it's running inside the desktop shell (needed for the D3 self-hosting toggle,
 * which is desktop-only). No generic ipcRenderer is exposed; when D3 adds
 * local-services control it will go through a narrow, explicitly-typed channel.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("umbryDesktop", {
  isDesktop: true,
  platform: process.platform,
  electron: process.versions.electron,
  // Native biometric unlock (macOS Touch ID). The web app's WebAuthn path is
  // unavailable inside Electron (no platform authenticator), so it falls back
  // to this bridge — the passphrase is sealed by the OS keychain in the main
  // process and only released after a Touch ID gesture.
  biometric: {
    isAvailable: (): Promise<boolean> => ipcRenderer.invoke("umbry:bio:available"),
    hasVault: (): Promise<boolean> => ipcRenderer.invoke("umbry:bio:has"),
    enroll: (mnemonic: string): Promise<boolean> => ipcRenderer.invoke("umbry:bio:enroll", mnemonic),
    unlock: (): Promise<string | null> => ipcRenderer.invoke("umbry:bio:unlock"),
    remove: (): Promise<boolean> => ipcRenderer.invoke("umbry:bio:remove"),
  },
  // Screen-share source picking. Electron's display-media handler can't show a
  // native picker without giving up system-audio capture, so the web app draws
  // its own: list() for the thumbnails, pick() to park the choice, then the
  // usual getDisplayMedia() call resolves to it.
  screen: {
    list: (): Promise<ScreenSource[]> => ipcRenderer.invoke("umbry:screen:sources"),
    pick: (id: string | null, audio: boolean): Promise<boolean> => ipcRenderer.invoke("umbry:screen:pick", id, audio),
  },
  // Auto-update control surface for Settings → Updates. Updates apply in-place
  // and preserve all local data, so the app never re-downloads or re-logs-in.
  updater: {
    status: (): Promise<UpdaterStatus> => ipcRenderer.invoke("umbry:update:status"),
    setEnabled: (enabled: boolean): Promise<UpdaterStatus> => ipcRenderer.invoke("umbry:update:set-enabled", enabled),
    check: (): Promise<UpdaterStatus> => ipcRenderer.invoke("umbry:update:check"),
    install: (): Promise<UpdaterStatus> => ipcRenderer.invoke("umbry:update:install"),
    // Subscribe to state changes (checking / downloading / downloaded / error).
    // Returns an unsubscribe function.
    onEvent: (cb: (s: UpdaterStatus) => void): (() => void) => {
      const listener = (_e: unknown, s: UpdaterStatus) => cb(s);
      ipcRenderer.on("umbry:update:event", listener);
      return () => ipcRenderer.removeListener("umbry:update:event", listener);
    },
  },
  // Screenshare audio capture (see docs/screenshare-audio.md). start() begins a
  // native (Phase 1: test-tone) PCM stream; onFrame delivers interleaved Float32
  // stereo chunks the renderer turns into a MediaStreamTrack — bypassing the
  // system-audio loopback that causes call echo.
  audioCapture: {
    start: (): Promise<{ sampleRate: number; channels: number }> => ipcRenderer.invoke("umbry:audio:start"),
    stop: (): Promise<boolean> => ipcRenderer.invoke("umbry:audio:stop"),
    onFrame: (cb: (pcm: ArrayBuffer) => void): (() => void) => {
      const listener = (_e: unknown, buf: ArrayBuffer) => cb(buf);
      ipcRenderer.on("umbry:audio:frame", listener);
      return () => ipcRenderer.removeListener("umbry:audio:frame", listener);
    },
  },
  // D3: local self-host stack (relay + LiveKit + Ollama) via docker compose.
  // Desktop-only — a browser tab has no business starting containers.
  stack: {
    status: (): Promise<StackStatus> => ipcRenderer.invoke("umbry:stack:status"),
    up: (): Promise<StackStatus> => ipcRenderer.invoke("umbry:stack:up"),
    down: (): Promise<StackStatus> => ipcRenderer.invoke("umbry:stack:down"),
  },
  // Native stack — the same three services as plain child processes, no Docker.
  // The relay ships with the app; LiveKit and Ollama are fetched on demand and
  // verified against pinned checksums.
  native: {
    status: (): Promise<NativeStatus> => ipcRenderer.invoke("umbry:native:status"),
    install: (id: ServiceId): Promise<NativeStatus> => ipcRenderer.invoke("umbry:native:install", id),
    start: (id?: ServiceId): Promise<NativeStatus> => ipcRenderer.invoke("umbry:native:start", id),
    stop: (): Promise<NativeStatus> => ipcRenderer.invoke("umbry:native:stop"),
    versions: (): Promise<Record<string, string>> => ipcRenderer.invoke("umbry:native:versions"),
    // Download progress + service state changes.
    onEvent: (cb: (s: NativeStatus) => void): (() => void) => {
      const listener = (_e: unknown, s: NativeStatus) => cb(s);
      ipcRenderer.on("umbry:native:event", listener);
      return () => ipcRenderer.removeListener("umbry:native:event", listener);
    },
  },
});

type ServiceId = "relay" | "livekit" | "ollama";

interface ServiceState {
  id: ServiceId;
  installed: boolean;
  running: boolean;
  downloadPercent: number | null;
  downloadMb: number | null;
  unavailable?: string;
  error?: string;
}

interface NativeStatus {
  services: ServiceState[];
  relayUrl: string;
  running: boolean;
}

interface StackService {
  name: string;
  state: string;
  running: boolean;
}

interface StackStatus {
  dockerAvailable: boolean;
  daemonRunning: boolean;
  services: StackService[];
  running: boolean;
  relayUrl: string;
  error?: string;
}

interface UpdaterStatus {
  version: string;
  enabled: boolean;
  supported: boolean;
  state: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  newVersion: string | null;
  percent: number | null;
  error: string | null;
}

interface ScreenSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string;
  appIcon: string;
}
