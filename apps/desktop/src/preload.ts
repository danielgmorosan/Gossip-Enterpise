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
});

interface ScreenSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string;
  appIcon: string;
}
