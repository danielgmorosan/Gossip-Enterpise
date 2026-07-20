import { create } from "zustand";

/**
 * Desktop-only screen-share source picker.
 *
 * In the browser, getDisplayMedia() shows the OS/browser picker itself. Inside
 * the Electron shell it can't: the shell has to resolve the source in its
 * display-media handler (that handler is the only place system audio can be
 * attached), so the native picker is off the table. We draw our own instead —
 * this store carries the pending request from useCall.toggleScreen to the
 * <ScreenSourcePicker> mounted in the app shell.
 */
export interface ScreenSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnail: string;
  appIcon: string;
}

interface DesktopScreenBridge {
  list: () => Promise<ScreenSource[]>;
  pick: (id: string | null, audio: boolean) => Promise<boolean>;
}

function bridge(): DesktopScreenBridge | null {
  const w = window as unknown as { umbryDesktop?: { screen?: DesktopScreenBridge } };
  return w.umbryDesktop?.screen ?? null;
}

/** True when we must show our own picker (i.e. we're in the desktop shell). */
export function needsSourcePicker(): boolean {
  return !!bridge();
}

/** null id = cancelled. */
export interface PickerChoice {
  id: string | null;
  audio: boolean;
}

interface PickerState {
  sources: ScreenSource[];
  open: boolean;
  /** Resolves the pending pickScreenSource() call. */
  resolve: ((choice: PickerChoice) => void) | null;
  choose: (choice: PickerChoice) => void;
}

export const useScreenPicker = create<PickerState>()((set, get) => ({
  sources: [],
  open: false,
  resolve: null,
  choose: (choice) => {
    const { resolve } = get();
    set({ open: false, sources: [], resolve: null });
    resolve?.(choice);
  },
}));

export type PickResult =
  /** User chose a source; the shell has been told which one. */
  | { status: "picked"; id: string; audio: boolean }
  /** User dismissed the picker — the share must not start. */
  | { status: "cancelled" }
  /** No picker to show (browser, or sources couldn't be enumerated). */
  | { status: "unavailable" };

/**
 * Show the picker and park the chosen source with the main process, so the
 * shell's display-media handler resolves to it on the getDisplayMedia() that
 * follows.
 */
export async function pickScreenSource(): Promise<PickResult> {
  const b = bridge();
  if (!b) return { status: "unavailable" };

  let sources: ScreenSource[] = [];
  try {
    sources = await b.list();
  } catch {
    // Enumeration failed — most likely Screen Recording permission hasn't been
    // granted yet. Let the share proceed: the shell falls back to the primary
    // screen, and that capture attempt is what raises the macOS prompt.
    return { status: "unavailable" };
  }
  // Screen-only for now. Per-window capture is unreliable on the Electron/macOS
  // combo we ship (the pick is honoured only intermittently, so a "share this
  // window" choice can silently broadcast the whole desktop) — unacceptable for
  // a privacy product. Whole-screen capture is reliable AND is the only source
  // that carries system audio, which is the feature people actually asked for.
  // Per-app sharing returns with the native ScreenCaptureKit path. See the
  // window-scoping notes in the desktop main process.
  sources = sources.filter((s) => s.kind === "screen");
  if (!sources.length) return { status: "unavailable" };

  const chosen = await new Promise<PickerChoice>((resolve) => {
    useScreenPicker.setState({ sources, open: true, resolve });
  });
  if (!chosen.id) {
    await b.pick(null, false);
    return { status: "cancelled" };
  }
  await b.pick(chosen.id, chosen.audio);
  return { status: "picked", id: chosen.id, audio: chosen.audio };
}
