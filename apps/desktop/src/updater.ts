/**
 * Auto-update (electron-updater) — keeps installed clients current without
 * anyone re-downloading from GitHub or re-logging-in.
 *
 * Feed: GitHub Releases (configured in electron-builder.yml `publish:`), so a
 * `desktop-v*` tag that publishes `latest.yml` + installers is picked up here.
 * Updates are in-place (NSIS on Windows, the app bundle on mac/Linux) and never
 * touch the app's userData dir — the biometric vault, identity, and local caches
 * survive every update. appId is stable, so the storage partition is too.
 *
 * The check is on by default and can be turned off in Settings → Updates. A
 * manual "Check now" works regardless of the toggle. Nothing installs silently
 * on the user mid-session: a downloaded update is staged and applied on quit
 * (autoInstallOnAppQuit), and the UI can offer "Restart to update" immediately.
 *
 * In dev (unpackaged) electron-updater has no app-update.yml and would throw, so
 * everything here no-ops and the IPC reports a dev state instead.
 */
import { app, ipcMain, type BrowserWindow } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { autoUpdater } from "electron-updater";

type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdaterStatus {
  version: string; // the running app version
  enabled: boolean; // automatic checks on?
  supported: boolean; // false in dev / unpackaged
  state: UpdateState;
  newVersion: string | null; // version of an available/downloaded update
  percent: number | null; // download progress, when downloading
  error: string | null;
}

const CONFIG_FILE = () => path.join(app.getPath("userData"), "updater-config.json");
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours while running

let enabled = true;
let state: UpdateState = "idle";
let newVersion: string | null = null;
let percent: number | null = null;
let lastError: string | null = null;
let timer: NodeJS.Timeout | null = null;
let getWin: (() => BrowserWindow | null) | null = null;

function readEnabled(): boolean {
  try {
    const raw = fs.readFileSync(CONFIG_FILE(), "utf8");
    const cfg = JSON.parse(raw) as { autoUpdate?: boolean };
    return cfg.autoUpdate !== false; // default ON
  } catch {
    return true;
  }
}

function writeEnabled(value: boolean): void {
  try {
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify({ autoUpdate: value }), "utf8");
  } catch {
    /* userData not writable — setting just won't persist across launches */
  }
}

function status(): UpdaterStatus {
  return {
    version: app.getVersion(),
    enabled,
    supported: app.isPackaged,
    state,
    newVersion,
    percent,
    error: lastError,
  };
}

function emit(): void {
  try {
    getWin?.()?.webContents.send("umbry:update:event", status());
  } catch {
    /* window gone */
  }
}

function setState(s: UpdateState, patch?: Partial<{ newVersion: string | null; percent: number | null; error: string | null }>): void {
  state = s;
  if (patch) {
    if ("newVersion" in patch) newVersion = patch.newVersion ?? null;
    if ("percent" in patch) percent = patch.percent ?? null;
    if ("error" in patch) lastError = patch.error ?? null;
  }
  emit();
}

/** Kick off a check. Safe to call anytime; no-ops (with state) when unsupported. */
async function checkNow(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    setState("idle");
    return status();
  }
  try {
    lastError = null;
    await autoUpdater.checkForUpdates();
  } catch (e) {
    setState("error", { error: e instanceof Error ? e.message : String(e) });
  }
  return status();
}

function startTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (enabled) void checkNow();
  }, CHECK_INTERVAL_MS);
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Wire the updater: register IPC and, when enabled, start automatic checks.
 * Call once from app.whenReady(). `win` resolves the window for progress events.
 */
export function setupUpdater(win: () => BrowserWindow | null): void {
  getWin = win;
  enabled = readEnabled();

  // Stage in the background; apply on quit. Never yank the app out from under
  // the user mid-use.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => setState("checking"));
  autoUpdater.on("update-available", (info) => setState("available", { newVersion: info?.version ?? null }));
  autoUpdater.on("update-not-available", () => setState("not-available", { newVersion: null, percent: null }));
  autoUpdater.on("download-progress", (p) => setState("downloading", { percent: Math.round(p?.percent ?? 0) }));
  autoUpdater.on("update-downloaded", (info) => setState("downloaded", { newVersion: info?.version ?? null, percent: 100 }));
  autoUpdater.on("error", (e) => setState("error", { error: e instanceof Error ? e.message : String(e) }));

  ipcMain.handle("umbry:update:status", () => status());

  ipcMain.handle("umbry:update:set-enabled", (_e, value: unknown) => {
    enabled = value !== false;
    writeEnabled(enabled);
    if (enabled) {
      startTimer();
      void checkNow();
    } else {
      stopTimer();
    }
    return status();
  });

  // Manual check works even when automatic checks are off.
  ipcMain.handle("umbry:update:check", () => checkNow());

  ipcMain.handle("umbry:update:install", () => {
    if (app.isPackaged && state === "downloaded") {
      // Force the install even though autoInstallOnAppQuit would also handle it.
      autoUpdater.quitAndInstall();
    }
    return status();
  });

  if (app.isPackaged && enabled) {
    startTimer();
    // Slight delay so the first check doesn't compete with window creation.
    setTimeout(() => void checkNow(), 4000);
  }
}
