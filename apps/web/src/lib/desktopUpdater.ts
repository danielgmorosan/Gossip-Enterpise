// Typed accessor for the desktop shell's auto-update bridge (preload exposes it
// on window.umbryDesktop.updater). Web builds have no bridge, so this returns
// null and the Updates settings page shows a "desktop only" note.

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdaterStatus {
  version: string;
  enabled: boolean;
  supported: boolean; // false in an unpackaged/dev desktop build
  state: UpdateState;
  newVersion: string | null;
  percent: number | null;
  error: string | null;
}

export interface DesktopUpdater {
  status(): Promise<UpdaterStatus>;
  setEnabled(enabled: boolean): Promise<UpdaterStatus>;
  check(): Promise<UpdaterStatus>;
  install(): Promise<UpdaterStatus>;
  onEvent(cb: (s: UpdaterStatus) => void): () => void;
}

export function desktopUpdater(): DesktopUpdater | null {
  const w = window as unknown as { umbryDesktop?: { updater?: DesktopUpdater } };
  return w.umbryDesktop?.updater ?? null;
}

/** True when running inside the desktop shell (the auto-updater is available). */
export function isDesktopApp(): boolean {
  return desktopUpdater() != null;
}
