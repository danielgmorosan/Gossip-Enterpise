/**
 * Bridge to the desktop shell's NATIVE self-host stack (no Docker).
 *
 * The relay ships inside the app and costs nothing to run; LiveKit and Ollama
 * are downloaded on demand and checksum-verified in the main process. In the
 * browser build none of this exists, and the UI says so.
 */

export type ServiceId = "relay" | "livekit" | "ollama";

export interface ServiceState {
  id: ServiceId;
  installed: boolean;
  running: boolean;
  /** 0-1 while downloading, else null. */
  downloadPercent: number | null;
  downloadMb: number | null;
  /** Set when this platform has no supported native build. */
  unavailable?: string;
  error?: string;
}

export interface NativeStatus {
  services: ServiceState[];
  relayUrl: string;
  running: boolean;
}

interface NativeBridge {
  status: () => Promise<NativeStatus>;
  install: (id: ServiceId) => Promise<NativeStatus>;
  start: (id?: ServiceId) => Promise<NativeStatus>;
  stop: () => Promise<NativeStatus>;
  versions: () => Promise<Record<string, string>>;
  onEvent: (cb: (s: NativeStatus) => void) => () => void;
}

function bridge(): NativeBridge | null {
  const d = (window as unknown as { umbryDesktop?: { native?: NativeBridge } }).umbryDesktop;
  return d?.native ?? null;
}

export function canRunNative(): boolean {
  return bridge() != null;
}

export const nativeStatus = () => bridge()?.status() ?? Promise.resolve(null);
export const nativeInstall = (id: ServiceId) => bridge()?.install(id) ?? Promise.resolve(null);
export const nativeStart = (id?: ServiceId) => bridge()?.start(id) ?? Promise.resolve(null);
export const nativeStop = () => bridge()?.stop() ?? Promise.resolve(null);

/** Subscribe to download progress / service state. No-op in the browser. */
export function onNativeEvent(cb: (s: NativeStatus) => void): () => void {
  return bridge()?.onEvent(cb) ?? (() => {});
}

export const SERVICE_META: Record<ServiceId, { title: string; blurb: string; enables: string }> = {
  relay: {
    title: "Relay",
    blurb: "Ships with Umbry — nothing to download.",
    enables: "Channels, files, search",
  },
  livekit: {
    title: "LiveKit",
    blurb: "Media server for voice, video, and screen share.",
    enables: "Calls",
  },
  ollama: {
    title: "Ollama",
    blurb: "Runs the AI model on this machine. Large — it includes GPU runtimes.",
    enables: "AI recaps & Q&A",
  },
};
