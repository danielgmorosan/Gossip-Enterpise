/**
 * Umbry desktop — Electron main process.
 *
 * A hardened shell that serves the built web app from a local `app://` scheme
 * (bundled inside the package) instead of loading umbry.chat over the network —
 * so the installed app starts instantly and works offline. Load precedence:
 *   1. UMBRY_DESKTOP_URL (dev: local Vite / a remote build)
 *   2. the on-disk bundle (app://bundle) — the shipped default
 *   3. https://umbry.chat (only if the bundle is missing)
 *
 * Because the bundle runs on the app:// origin (not umbry.chat), the CORS/WS-
 * pinned backends would reject it, so installOriginSpoof() presents the trusted
 * Origin on backend calls and rewrites the echoed CORS header back to app://.
 *
 * Security posture (see also preload.ts):
 * - contextIsolation on, nodeIntegration off, sandbox on — the renderer never
 *   touches Node.
 * - Navigation is pinned to the app origin; everything else (external links,
 *   window.open) opens in the system browser instead of an in-app window.
 */
import { app, BrowserWindow, shell, session, ipcMain, systemPreferences, safeStorage, desktopCapturer, protocol } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import { setupUpdater } from "./updater";
import { winHelloAvailable, winHelloVerify } from "./winHello";
import { setupAudioCapture } from "./audioCapture";

// ── Local bundle (serve the built web app from disk, not over the network) ───
// Loading the UI remotely from umbry.chat on every launch is what makes the
// installed app feel slow/glitchy. Instead we ship apps/web/dist inside the
// package and serve it from a custom secure scheme, so startup is instant and
// offline-capable. The scheme is registered as secure+standard so the crypto
// WASM's SharedArrayBuffer (which needs cross-origin isolation) still works.
const APP_SCHEME = "app";
const APP_HOST = "bundle";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const TRUSTED_ORIGIN = "https://umbry.chat"; // the origin the backends allowlist

// Where the built web app lives: packaged → resources/web (electron-builder
// extraResources); dev run → apps/web/dist relative to this compiled file.
function bundleDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(__dirname, "..", "..", "web", "dist");
}
function hasBundle(): boolean {
  try {
    return fs.existsSync(path.join(bundleDir(), "index.html"));
  } catch {
    return false;
  }
}

// Where to load the UI from. A dev override always wins (local Vite / remote);
// otherwise prefer the on-disk bundle; fall back to remote only if it's missing.
function startUrl(): string {
  if (process.env.UMBRY_DESKTOP_URL) return process.env.UMBRY_DESKTOP_URL;
  // Load at the origin root (not /index.html) so the SPA router runs its Entry
  // redirect (returning user -> unlock) instead of the path falling to the
  // catch-all. The app:// handler serves index.html for "/".
  if (hasBundle()) return `${APP_ORIGIN}/`;
  return "https://umbry.chat";
}
const BUNDLE_MODE = startUrl().startsWith(`${APP_SCHEME}://`);

// Enable macOS system-audio loopback for screen sharing. Without these Chromium
// flags `audio: "loopback"` yields a live-but-SILENT track (peak RMS 0.0) —
// which is exactly how the shared screen was silent while looking fine.
//
// Chromium has two backends and the right one depends on the OS version:
//   • macOS 13–14  → ScreenCaptureKit  (MacSckSystemAudioLoopbackOverride)
//   • macOS 15+    → Core Audio taps   (MacCatapSystemAudioLoopbackCapture)
// Both are listed on purpose: Catap takes precedence where it's supported, so
// this one switch covers 13 through 26. Omitting Catap is what broke capture on
// modern macOS. Must be set before app "ready".
if (process.platform === "darwin") {
  app.commandLine.appendSwitch(
    "enable-features",
    "MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride,MacCatapSystemAudioLoopbackCapture",
  );
}

// Register the app scheme as privileged BEFORE app "ready" (required by Electron).
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain",
  ".webmanifest": "application/manifest+json",
};

/** Serve the bundled web app over app://, with the COOP/COEP the WASM needs. */
function installAppProtocol(): void {
  const root = path.resolve(bundleDir());
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    let filePath = path.normalize(path.join(root, pathname));
    // Block path traversal outside the bundle root.
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }
    // SPA: any route without a real file (client-side routing, or a bare path)
    // resolves to index.html so React Router can handle it.
    if (!path.extname(filePath) || !fs.existsSync(filePath)) {
      filePath = path.join(root, "index.html");
    }
    try {
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": MIME[ext] ?? "application/octet-stream",
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

// Backends pin CORS/WS to https://umbry.chat, so from the app:// origin they'd
// reject us. Present the trusted Origin on outgoing requests and rewrite the
// echoed Access-Control-Allow-Origin back to our origin so the browser's CORS
// check passes — the same trick as the Vite dev proxy, at the network layer.
// Only installed in bundle mode (remote/dev already run on an allowed origin).
function installOriginSpoof(): void {
  const sess = session.defaultSession;
  const filter = {
    urls: [
      "*://api.usegossip.com/*",
      "*://gossip-relay-danielgm.fly.dev/*",
      "ws://gossip-relay-danielgm.fly.dev/*",
      "wss://gossip-relay-danielgm.fly.dev/*",
    ],
  };
  sess.webRequest.onBeforeSendHeaders(filter, (details, cb) => {
    const requestHeaders = { ...details.requestHeaders, Origin: TRUSTED_ORIGIN };
    cb({ requestHeaders });
  });
  sess.webRequest.onHeadersReceived(filter, (details, cb) => {
    const responseHeaders = { ...(details.responseHeaders ?? {}) };
    for (const k of Object.keys(responseHeaders)) {
      if (/^access-control-allow-(origin|credentials)$/i.test(k)) delete responseHeaders[k];
    }
    responseHeaders["Access-Control-Allow-Origin"] = [APP_ORIGIN];
    responseHeaders["Access-Control-Allow-Credentials"] = ["true"];
    cb({ responseHeaders });
  });
}

// Permissions the renderer is allowed to use. "media" covers camera + mic for
// calls/voice; on macOS we additionally trigger the OS-level (TCC) prompt below,
// otherwise Chromium reports the device but the system hands back empty tracks.
// Grant what a chat/calls/local-first PWA legitimately needs; deny the rest
// (geolocation, hid, serial, usb, midi, …). Electron otherwise defaults to
// allowing everything, so this both fixes camera/mic and tightens the shell.
const ALLOWED_PERMISSIONS = new Set([
  "media", // camera + microphone (calls, voice messages)
  "display-capture", // screen sharing
  "fullscreen", // fullscreen a screenshare
  "notifications", // message notifications
  "persistent-storage", // local-first Drizzle/wa-sqlite DB
  "clipboard-read",
  "clipboard-sanitized-write",
  "pointerLock",
]);

/**
 * Wire permission handling for the app's session. Without this, Electron denies
 * every getUserMedia request by default, so the camera/mic never turn on.
 */
function installPermissionHandlers(): void {
  const sess = session.defaultSession;
  sess.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (!ALLOWED_PERMISSIONS.has(permission)) {
      callback(false);
      return;
    }
    if (permission === "media" && process.platform === "darwin") {
      // Ask macOS for camera/mic access (first call shows the system prompt;
      // later calls resolve immediately with the remembered decision) before
      // letting Chromium proceed.
      const mediaTypes = (details as { mediaTypes?: string[] }).mediaTypes ?? ["video", "audio"];
      const asks: Promise<boolean>[] = [];
      if (mediaTypes.includes("video")) asks.push(systemPreferences.askForMediaAccess("camera"));
      if (mediaTypes.includes("audio")) asks.push(systemPreferences.askForMediaAccess("microphone"));
      void Promise.allSettled(asks).then((results) => {
        // Grant if the OS granted at least the devices that were asked for.
        callback(results.every((r) => r.status === "fulfilled" && r.value));
      });
      return;
    }
    callback(true);
  });
  // Synchronous check used by some web APIs (e.g. enumerateDevices/permissions.query).
  sess.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));

  // Screen sharing: getDisplayMedia() throws in Electron unless a display-media
  // handler is registered, which is why "Share screen" did nothing.
  //
  // We deliberately do NOT use the native system picker (useSystemPicker): it
  // times out on this Electron/macOS build AND, when it does work, it bypasses
  // this callback — which is the only place we can attach audio. So the renderer
  // draws its own picker: umbry:screen:sources → show thumbnails →
  // umbry:screen:pick parks the choice here before calling getDisplayMedia().
  //
  // SCREEN-ONLY: we only ever park whole-screen source ids. Per-window capture
  // is honoured only intermittently on this build (a window pick can silently
  // fall back to the whole screen), so we don't offer it rather than risk
  // over-sharing. Whole-screen capture is reliable and is also the only source
  // that carries system audio. (True per-app video+audio would need a native
  // ScreenCaptureKit addon, the way Discord does it — Chromium can't express it.)
  sess.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ["screen"] })
      .then((sources) => {
        const picked = pendingSourceId ? sources.find((s) => s.id === pendingSourceId) : undefined;
        const wantsAudio = pendingSourceId ? pendingAudio : true;
        // Consume the pick — a later share without one falls back to the primary
        // screen with audio, which is the pre-picker behaviour.
        pendingSourceId = null;
        pendingAudio = true;
        const source = picked ?? sources[0];
        if (!source) return callback({});
        callback(request.audioRequested && wantsAudio ? { video: source, audio: "loopback" } : { video: source });
      })
      .catch(() => callback({}));
  });
}

// ── Screen-share source picker ──────────────────────────────────────────────
// Set by the renderer immediately before getDisplayMedia(); read (and cleared)
// by the display-media handler above.
let pendingSourceId: string | null = null;
let pendingAudio = true;

function installScreenSourceHandlers(): void {
  ipcMain.handle("umbry:screen:sources", async () => {
    // Screens only — window enumeration would leak titles of apps we won't
    // offer to share, and the renderer filters them out anyway.
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 320, height: 200 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: "screen" as const,
      thumbnail: s.thumbnail.isEmpty() ? "" : s.thumbnail.toDataURL(),
      appIcon: "",
    }));
  });
  ipcMain.handle("umbry:screen:pick", (_e, id: unknown, audio: unknown) => {
    pendingSourceId = typeof id === "string" && id ? id : null;
    pendingAudio = audio !== false;
    return true;
  });
}

// ── Native biometric unlock (macOS Touch ID) ────────────────────────────────
// Electron's Chromium exposes no platform WebAuthn authenticator, so the web
// app's Touch ID / Hello path is unavailable inside the shell. We bridge it
// natively: the recovery passphrase is sealed with the OS keychain (safeStorage)
// and only returned after a successful Touch ID gesture.
const bioVaultFile = (): string => path.join(app.getPath("userData"), "bio-vault.bin");

function installBiometricHandlers(): void {
  // Windows Hello is gated OFF: the WinRT verification dialog isn't parented to
  // our window, so it opens behind Umbry / only in the taskbar (bad UX). A clean
  // fix needs the window-parented interop (RequestVerificationForWindowAsync with
  // our HWND) via a compiled helper. Until then, Windows unlocks with the password
  // vault (comparable security). Flip this to re-enable — winHello.ts is kept.
  const WINDOWS_HELLO_ENABLED = false;

  // Can this OS do a native unlock gesture (Touch ID on macOS) AND seal secrets
  // at rest (safeStorage / DPAPI)?
  const nativeBioSupported = async (): Promise<boolean> => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false;
      if (process.platform === "darwin") return systemPreferences.canPromptTouchID();
      if (process.platform === "win32") return WINDOWS_HELLO_ENABLED && (await winHelloAvailable());
      return false;
    } catch {
      return false;
    }
  };

  // Show the platform gesture; resolve true only when the user actually verified.
  const nativeVerify = async (reason: string): Promise<boolean> => {
    try {
      if (process.platform === "darwin") {
        await systemPreferences.promptTouchID(reason); // throws on cancel/fail
        return true;
      }
      if (process.platform === "win32") return WINDOWS_HELLO_ENABLED && (await winHelloVerify(reason));
      return false;
    } catch {
      return false;
    }
  };

  ipcMain.handle("umbry:bio:available", () => nativeBioSupported());
  ipcMain.handle("umbry:bio:has", () => {
    try {
      return fs.existsSync(bioVaultFile());
    } catch {
      return false;
    }
  });
  ipcMain.handle("umbry:bio:enroll", async (_e, mnemonic: unknown) => {
    if (typeof mnemonic !== "string" || mnemonic.length === 0) return false;
    if (!(await nativeBioSupported())) return false;
    if (!(await nativeVerify("set up unlock for Umbry"))) return false;
    try {
      fs.writeFileSync(bioVaultFile(), safeStorage.encryptString(mnemonic));
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle("umbry:bio:unlock", async () => {
    try {
      if (!fs.existsSync(bioVaultFile())) return null;
    } catch {
      return null;
    }
    if (!(await nativeVerify("unlock Umbry"))) return null;
    try {
      return safeStorage.decryptString(fs.readFileSync(bioVaultFile()));
    } catch {
      return null;
    }
  });
  ipcMain.handle("umbry:bio:remove", () => {
    try {
      fs.rmSync(bioVaultFile(), { force: true });
    } catch {
      /* already gone */
    }
    return true;
  });
}

// Origin of a URL, treating our custom app:// scheme (whose spec origin is
// opaque "null") as scheme://host so navigation pinning works in bundle mode.
function originOf(u: string): string | null {
  if (u.startsWith(`${APP_SCHEME}://`)) {
    try {
      return `${APP_SCHEME}://${new URL(u).host}`;
    } catch {
      return null;
    }
  }
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}
function appOrigin(): string | null {
  return originOf(startUrl());
}

// Single-instance: focus the existing window instead of opening a second one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win: BrowserWindow | null = null;

  const createWindow = () => {
    win = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: "#0b0b0f",
      title: "Umbry",
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });

    win.once("ready-to-show", () => win?.show());
    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
      console.error(`[desktop] failed to load ${url}: ${desc} (${code})`);
    });
    // Dev-only diagnostics: forward renderer warnings/errors (CORS, WASM, …) to
    // the shell's stdout. Off in packaged builds so nothing leaks to logs.
    if (!app.isPackaged) {
      win.webContents.on("did-finish-load", () => console.log(`[desktop] loaded ${startUrl()}`));
      win.webContents.on("console-message", (_e, level, message) => {
        if (level >= 2) console.log(`[renderer] ${message}`);
      });
      console.log(`[desktop] start url = ${startUrl()} (bundleMode=${BUNDLE_MODE}, dir=${bundleDir()})`);
    }
    void win.loadURL(startUrl());
    win.on("closed", () => {
      win = null;
    });
  };

  // Keep the app inside its own origin; open anything else in the real browser.
  app.on("web-contents-created", (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      const origin = appOrigin();
      const target = originOf(url);
      if (origin && target !== origin) {
        event.preventDefault();
        if (/^https?:/.test(url)) void shell.openExternal(url);
      }
    });
  });

  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    installAppProtocol();
    if (BUNDLE_MODE) installOriginSpoof();
    installPermissionHandlers();
    installBiometricHandlers();
    installScreenSourceHandlers();
    createWindow();
    // Auto-update: check GitHub Releases in the background and stage updates for
    // install-on-quit. In-place, keeps userData — no re-download, no re-login.
    setupUpdater(() => win);
    // Screenshare audio pipeline (echo-free): streams native/test-tone PCM to the
    // renderer, which publishes it as a MediaStreamTrack (docs/screenshare-audio.md).
    setupAudioCapture(() => win?.webContents ?? null);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
