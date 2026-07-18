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
});
