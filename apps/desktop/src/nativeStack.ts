/**
 * Native self-host stack — no Docker required.
 *
 * Runs the three services as ordinary child processes in the app's own data
 * directory. Nothing is installed system-wide, nothing needs admin rights, and
 * nothing needs a hypervisor:
 *
 *   relay    — bundled. Electron already ships a Node runtime, so the relay is
 *              esbuilt to a single .mjs at build time and run with
 *              ELECTRON_RUN_AS_NODE. Zero download.
 *   livekit  — ~17MB, fetched on demand from the pinned upstream release.
 *   ollama   — 139MB (macOS) / ~1.4GB (Win+Linux), fetched on demand.
 *
 * Docker remains available for shared/team servers (see selfhost.ts); this is
 * the path for one person who just wants it to work.
 */
import { app, ipcMain, type WebContents } from "electron";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, rm, chmod, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { LIVEKIT, OLLAMA, VERSIONS, platformKey, type Download } from "./nativeManifest";

export type ServiceId = "relay" | "livekit" | "ollama";

export interface ServiceState {
  id: ServiceId;
  /** Binary present (relay is always true — it ships with the app). */
  installed: boolean;
  running: boolean;
  /** 0-1 while downloading, else null. */
  downloadPercent: number | null;
  /** Approximate download size, for the UI to warn before a big fetch. */
  downloadMb: number | null;
  /** Set when this platform has no supported native build. */
  unavailable?: string;
  error?: string;
}

export interface NativeStatus {
  services: ServiceState[];
  /** Relay reachable, i.e. channels/files work. */
  relayUrl: string;
  running: boolean;
}

const PORTS = { relay: 8788, livekit: 7880, ollama: 11434 };

const ROOT = () => join(app.getPath("userData"), "native");
const BIN = () => join(ROOT(), "bin");
const DATA = () => join(ROOT(), "data");
const CONFIG = () => join(ROOT(), "config.json");

interface StackConfig {
  livekitKey: string;
  livekitSecret: string;
  host: string;
  aiModel: string;
}

let cfgCache: StackConfig | null = null;
async function config(): Promise<StackConfig> {
  if (cfgCache) return cfgCache;
  try {
    cfgCache = JSON.parse(await readFile(CONFIG(), "utf8"));
    return cfgCache!;
  } catch {
    // Fresh credentials per install — never a shipped default secret.
    const fresh: StackConfig = {
      livekitKey: randomBytes(16).toString("hex"),
      livekitSecret: randomBytes(32).toString("hex"),
      host: "localhost",
      aiModel: "qwen2.5:7b",
    };
    await mkdir(ROOT(), { recursive: true });
    await writeFile(CONFIG(), JSON.stringify(fresh, null, 2), "utf8");
    cfgCache = fresh;
    return fresh;
  }
}

// ── download + verify + extract ─────────────────────────────────────────────

const progress: Partial<Record<ServiceId, number>> = {};
const errors: Partial<Record<ServiceId, string>> = {};
let emitTo: (() => WebContents | null) | null = null;

function pushStatus() {
  void status().then((s) => emitTo?.()?.send("umbry:native:event", s));
}

/** Stream a URL to disk, verifying it against the pinned sha256. */
async function download(id: ServiceId, dl: Download, dest: string): Promise<void> {
  const res = await fetch(dl.url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const total = Number(res.headers.get("content-length") ?? 0);

  await mkdir(dirname(dest), { recursive: true });
  const hash = createHash("sha256");
  let seen = 0;

  const src = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  src.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    seen += chunk.length;
    if (total) {
      const pct = seen / total;
      // Throttle to whole percents; this fires thousands of times otherwise.
      if (progress[id] === undefined || pct - (progress[id] ?? 0) >= 0.01) {
        progress[id] = pct;
        pushStatus();
      }
    }
  });
  await pipeline(src, createWriteStream(dest));

  const got = hash.digest("hex");
  if (got !== dl.sha256) {
    await rm(dest, { force: true });
    // Refuse to run a binary we can't vouch for, rather than "probably fine".
    throw new Error(`checksum mismatch — expected ${dl.sha256.slice(0, 12)}…, got ${got.slice(0, 12)}…`);
  }
}

function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (err, _o, stderr) =>
      err ? reject(new Error(String(stderr || err).slice(0, 300))) : resolve(),
    );
  });
}

/**
 * Unpack an archive. Uses the system `tar`, which handles zip as well as
 * tar.gz on every platform we target (Windows 10+ ships bsdtar). zstd needs a
 * zstd-capable tar, which is why Linux+Ollama is best-effort.
 */
async function extract(archive: string, dir: string, format: Download["format"]): Promise<void> {
  await mkdir(dir, { recursive: true });
  if (format === "tar.zst") {
    try {
      await run("tar", ["--zstd", "-xf", archive, "-C", dir]);
      return;
    } catch {
      throw new Error(
        "This archive needs a zstd-capable tar. Install ollama from your package manager, or use the Docker stack.",
      );
    }
  }
  await run("tar", ["-xf", archive, "-C", dir]);
}

function dlFor(id: ServiceId): Download | undefined {
  const key = platformKey();
  if (id === "livekit") return LIVEKIT[key];
  if (id === "ollama") return OLLAMA[key];
  return undefined;
}

/**
 * A service binary we ship inside the app rather than download.
 *
 * Today that's LiveKit on macOS: upstream publishes no darwin build, so CI
 * compiles one from source at the pinned tag (Apache-2.0) and it rides along in
 * the .app. Bundled always wins over a download — it's already verified by
 * virtue of being part of the signed app.
 */
function bundledBinary(id: ServiceId): string | null {
  if (id !== "livekit" || process.platform !== "darwin") return null;
  return app.isPackaged
    ? join(process.resourcesPath, "bin", "livekit-server")
    : join(app.getAppPath(), "vendor-bin", "livekit-server");
}

function binaryPath(id: ServiceId): string | null {
  if (id === "relay") return relayBundle();
  const bundled = bundledBinary(id);
  if (bundled && existsSync(bundled)) return bundled;
  const dl = dlFor(id);
  if (!dl) return bundled;
  return join(BIN(), id, dl.binPath);
}

/**
 * The esbuilt relay, shipped inside the app — no download, ever.
 *
 * Packaged it's a fixed resource path. In dev the app root depends on how
 * Electron was invoked (`electron .` from apps/desktop, from the repo root, or
 * a bare script), so try the plausible spots rather than betting on one.
 */
function relayBundle(): string {
  if (app.isPackaged) return join(process.resourcesPath, "relay.mjs");
  const override = process.env.UMBRY_RELAY_BUNDLE;
  if (override) return override;
  const candidates = [
    join(app.getAppPath(), "dist-relay", "relay.mjs"),
    join(app.getAppPath(), "apps", "desktop", "dist-relay", "relay.mjs"),
    join(__dirname, "..", "dist-relay", "relay.mjs"),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
}

function isInstalled(id: ServiceId): boolean {
  const p = binaryPath(id);
  return p ? existsSync(p) : false;
}

export async function install(id: ServiceId): Promise<void> {
  if (id === "relay") return;
  // Shipped with the app (LiveKit on macOS) — nothing to fetch.
  if (isInstalled(id)) return;
  const dl = dlFor(id);
  if (!dl) throw new Error(`No native ${id} build for this platform.`);
  delete errors[id];
  progress[id] = 0;
  pushStatus();
  const tmp = join(ROOT(), "tmp", `${id}-download`);
  try {
    await download(id, dl, tmp);
    const dir = join(BIN(), id);
    await rm(dir, { recursive: true, force: true });
    await extract(tmp, dir, dl.format);
    // Archives sometimes nest everything one level down; flatten if the
    // expected binary isn't where the manifest says it should be.
    if (!existsSync(join(dir, dl.binPath))) {
      const entries = await readdir(dir);
      for (const e of entries) {
        const nested = join(dir, e);
        if ((await stat(nested)).isDirectory() && existsSync(join(nested, dl.binPath))) {
          await run(process.platform === "win32" ? "cmd" : "sh",
            process.platform === "win32"
              ? ["/c", "move", join(nested, "*"), dir]
              : ["-c", `mv "${nested}"/* "${dir}"/`]);
          break;
        }
      }
    }
    if (process.platform !== "win32") {
      const b = join(dir, dl.binPath);
      if (existsSync(b)) await chmod(b, 0o755);
    }
  } catch (e) {
    errors[id] = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    delete progress[id];
    await rm(tmp, { force: true });
    pushStatus();
  }
}

// ── process supervision ─────────────────────────────────────────────────────

const procs: Partial<Record<ServiceId, ChildProcess>> = {};

function alive(id: ServiceId): boolean {
  const p = procs[id];
  return Boolean(p && p.exitCode === null && !p.killed);
}

async function startRelay(): Promise<void> {
  if (alive("relay")) return;
  const cfg = await config();
  await mkdir(DATA(), { recursive: true });
  const child = spawn(process.execPath, [relayBundle()], {
    env: {
      ...process.env,
      // Run Electron's binary as a plain Node process.
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORTS.relay),
      DATA_DIR: DATA(),
      LIVEKIT_URL: `ws://${cfg.host}:${PORTS.livekit}`,
      LIVEKIT_SERVER_URL: `http://127.0.0.1:${PORTS.livekit}`,
      LIVEKIT_API_KEY: cfg.livekitKey,
      LIVEKIT_API_SECRET: cfg.livekitSecret,
      OLLAMA_URL: `http://127.0.0.1:${PORTS.ollama}`,
      AI_ROUTE: "local",
      AI_MODEL: cfg.aiModel,
      CORS_ORIGIN: "*",
      RELAY_REQUIRE_AUTH: "1",
    },
    stdio: "ignore",
    windowsHide: true,
  });
  procs.relay = child;
  child.on("exit", () => pushStatus());
}

async function startLivekit(): Promise<void> {
  if (alive("livekit")) return;
  const bin = binaryPath("livekit");
  if (!bin || !existsSync(bin)) throw new Error("LiveKit isn't downloaded yet.");
  const cfg = await config();
  const confPath = join(ROOT(), "livekit.yaml");
  await writeFile(
    confPath,
    [
      `port: ${PORTS.livekit}`,
      "rtc:",
      "  port_range_start: 50000",
      "  port_range_end: 50100",
      "  tcp_port: 7881",
      // Local/LAN box, not a cloud VM — don't probe a metadata service.
      "  use_external_ip: false",
      `  node_ip: ${cfg.host === "localhost" ? "127.0.0.1" : cfg.host}`,
      "logging:",
      "  level: warn",
      "room:",
      "  auto_create: true",
      "  empty_timeout: 60",
      "keys:",
      `  ${cfg.livekitKey}: ${cfg.livekitSecret}`,
      "",
    ].join("\n"),
    "utf8",
  );
  const child = spawn(bin, ["--config", confPath], { stdio: "ignore", windowsHide: true });
  procs.livekit = child;
  child.on("exit", () => pushStatus());
}

async function startOllama(): Promise<void> {
  if (alive("ollama")) return;
  const bin = binaryPath("ollama");
  if (!bin || !existsSync(bin)) throw new Error("Ollama isn't downloaded yet.");
  const child = spawn(bin, ["serve"], {
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${PORTS.ollama}`,
      // Keep weights inside the app's data dir so uninstalling is clean and we
      // don't collide with a system-wide Ollama the user may also have.
      OLLAMA_MODELS: join(DATA(), "models"),
    },
    stdio: "ignore",
    windowsHide: true,
  });
  procs.ollama = child;
  child.on("exit", () => pushStatus());
}

export async function startAll(): Promise<NativeStatus> {
  // Relay always starts — it's free. The other two only if present; the UI
  // installs them explicitly so a 1.4GB fetch is never a surprise.
  await startRelay();
  if (isInstalled("livekit")) await startLivekit().catch((e) => (errors.livekit = String(e)));
  if (isInstalled("ollama")) await startOllama().catch((e) => (errors.ollama = String(e)));
  pushStatus();
  return status();
}

export async function startOne(id: ServiceId): Promise<NativeStatus> {
  delete errors[id];
  try {
    if (id === "relay") await startRelay();
    else if (id === "livekit") await startLivekit();
    else await startOllama();
  } catch (e) {
    errors[id] = e instanceof Error ? e.message : String(e);
  }
  pushStatus();
  return status();
}

export function stopAll(): NativeStatus {
  for (const id of Object.keys(procs) as ServiceId[]) {
    try {
      procs[id]?.kill();
    } catch {
      /* already gone */
    }
    delete procs[id];
  }
  return {
    services: [],
    relayUrl: `http://localhost:${PORTS.relay}`,
    running: false,
  };
}

export async function status(): Promise<NativeStatus> {
  const key = platformKey();
  const mk = (id: ServiceId, mb: number | null): ServiceState => {
    const dl = dlFor(id);
    const bundled = Boolean(bundledBinary(id) && existsSync(bundledBinary(id)!));
    // Only truly unavailable when there's neither a bundled copy nor a
    // download for this platform.
    const unavailable =
      id !== "relay" && !dl && !bundled
        ? "No native build for this platform — use the Docker stack."
        : undefined;
    return {
      id,
      installed: isInstalled(id),
      running: alive(id),
      downloadPercent: progress[id] ?? null,
      // Bundled binaries ship with the app, so there's nothing to download.
      downloadMb: bundled ? null : mb,
      unavailable,
      error: errors[id],
    };
  };
  const ollamaMb = key.startsWith("darwin") ? 139 : 1430;
  return {
    services: [mk("relay", null), mk("livekit", 17), mk("ollama", ollamaMb)],
    relayUrl: `http://localhost:${PORTS.relay}`,
    running: alive("relay"),
  };
}

export function setupNativeStack(getWc: () => WebContents | null): void {
  emitTo = getWc;
  ipcMain.handle("umbry:native:status", () => status());
  ipcMain.handle("umbry:native:install", (_e, id: ServiceId) => install(id).then(status, () => status()));
  ipcMain.handle("umbry:native:start", (_e, id?: ServiceId) => (id ? startOne(id) : startAll()));
  ipcMain.handle("umbry:native:stop", () => stopAll());
  ipcMain.handle("umbry:native:versions", () => VERSIONS);
  // Never leave orphaned servers behind when the app closes.
  app.on("before-quit", () => stopAll());
}
