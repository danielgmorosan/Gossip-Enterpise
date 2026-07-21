import { useCallback, useEffect, useRef, useState } from "react";
import { Server, ShieldCheck, CircleDot, RefreshCw, Lock, Cloud, HardDrive, Play, Square, ExternalLink, AlertTriangle, Download } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, Input } from "@umbry/ui/stack";
import { cn } from "@/lib/utils";
import {
  defaults,
  getOverrides,
  setOverrides,
  getMode,
  setMode,
  LOCAL_STACK_RELAY,
  type HostMode,
} from "@/lib/endpoints";
import {
  canControlStack,
  stackStatus,
  stackUp,
  stackDown,
  SERVICE_LABELS,
  type StackStatus,
} from "@/lib/desktopStack";
import {
  canRunNative,
  nativeStatus,
  nativeInstall,
  nativeStart,
  nativeStop,
  onNativeEvent,
  SERVICE_META,
  type NativeStatus,
  type ServiceId,
} from "@/lib/desktopNative";

type Health = "unknown" | "checking" | "ok" | "down";

/** Probe a relay's /health without disturbing the live (saved) endpoint. */
async function probe(base: string): Promise<boolean> {
  const url = `${base.replace(/\/+$/, "")}/health`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url || "/health", { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Switching infrastructure changes every open socket — simplest correct move is a reload. */
function applyAndReload() {
  location.reload();
}

function ModeCard({
  active,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: typeof Cloud;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-card border p-4 text-left transition-colors",
        active ? "border-ink bg-field" : "border-line bg-paper-2 hover:bg-field",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", active ? "text-ink" : "text-ink-mute")} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
          {title}
          {active && <span className="rounded-control bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper">ACTIVE</span>}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-mute">{desc}</p>
      </div>
    </button>
  );
}

/**
 * Native stack — the default path. No Docker, no admin rights: the relay ships
 * with the app, and the other two are optional downloads gated behind an
 * explicit click so a 1.4GB fetch never happens by surprise.
 */
function NativePanel({ onUseRelay }: { onUseRelay: (url: string) => void }) {
  const [st, setSt] = useState<NativeStatus | null>(null);
  const [busy, setBusy] = useState<ServiceId | "all" | null>(null);

  useEffect(() => {
    void nativeStatus().then(setSt);
    // Main process pushes download progress and process exits.
    return onNativeEvent(setSt);
  }, []);

  const svc = (id: ServiceId) => st?.services.find((s) => s.id === id);

  const doInstall = async (id: ServiceId) => {
    setBusy(id);
    try {
      setSt(await nativeInstall(id));
      setSt(await nativeStart(id));
    } finally {
      setBusy(null);
    }
  };

  const startAll = async () => {
    setBusy("all");
    try {
      setSt(await nativeStart());
    } finally {
      setBusy(null);
    }
  };

  const stop = async () => {
    setBusy("all");
    try {
      setSt(await nativeStop());
      setSt(await nativeStatus());
    } finally {
      setBusy(null);
    }
  };

  const relay = svc("relay");

  return (
    <SettingGroup title="Local services">
      <SettingRow
        label={relay?.running ? "Running on this machine" : "Not running"}
        desc={
          relay?.running
            ? "Umbry is serving your channels, files, and search itself."
            : "Start the relay to host channels and files yourself. Nothing to install — it ships with Umbry."
        }
        control={
          <div className="flex items-center gap-2">
            {relay?.running ? (
              <Button variant="secondary" size="sm" onClick={() => void stop()} disabled={busy !== null}>
                <Square className="size-4" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void startAll()} disabled={busy !== null}>
                <Play className="size-4" /> {busy === "all" ? "Starting…" : "Start"}
              </Button>
            )}
          </div>
        }
      />

      {(["relay", "livekit", "ollama"] as ServiceId[]).map((id) => {
        const s = svc(id);
        const meta = SERVICE_META[id];
        const downloading = s?.downloadPercent != null;
        return (
          <div key={id} className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <CircleDot
                className={cn(
                  "size-3.5 shrink-0",
                  s?.running ? "text-positive" : s?.installed ? "text-ink-faint" : "text-ink-faint/50",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                  {meta.title}
                  <span className="rounded-control bg-field px-1.5 py-0.5 text-[10.5px] font-normal text-ink-mute">
                    {meta.enables}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-ink-mute">
                  {s?.unavailable ?? meta.blurb}
                </div>
                {s?.error && <div className="mt-1 text-[12px] text-negative">{s.error}</div>}
              </div>
              <div className="shrink-0">
                {id === "relay" ? (
                  <span className="text-[12px] text-ink-faint">{s?.running ? "running" : "included"}</span>
                ) : s?.unavailable ? (
                  <span className="text-[12px] text-ink-faint">unavailable</span>
                ) : s?.installed ? (
                  <span className={cn("text-[12px]", s.running ? "text-positive" : "text-ink-faint")}>
                    {s.running ? "running" : "installed"}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void doInstall(id)}
                    disabled={busy !== null || downloading}
                  >
                    <Download className="size-4" />
                    {downloading
                      ? `${Math.round((s!.downloadPercent ?? 0) * 100)}%`
                      : `Add (${s?.downloadMb ?? "?"} MB)`}
                  </Button>
                )}
              </div>
            </div>
            {downloading && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-field">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-300"
                  style={{ width: `${Math.round((s!.downloadPercent ?? 0) * 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}

      {relay?.running && (
        <SettingRow
          label="Use this relay"
          desc={`Point Umbry at the services running on this machine (${st?.relayUrl ?? LOCAL_STACK_RELAY}).`}
          control={
            <Button variant="secondary" size="sm" onClick={() => onUseRelay(st?.relayUrl ?? LOCAL_STACK_RELAY)}>
              Use it
            </Button>
          }
        />
      )}
    </SettingGroup>
  );
}

function StackPanel({ onUseRelay }: { onUseRelay: (url: string) => void }) {
  const [status, setStatus] = useState<StackStatus | null>(null);
  const [busy, setBusy] = useState<"up" | "down" | null>(null);
  const poll = useRef<number | null>(null);

  const refresh = useCallback(async () => setStatus(await stackStatus()), []);

  useEffect(() => {
    void refresh();
    return () => {
      if (poll.current) window.clearInterval(poll.current);
    };
  }, [refresh]);

  // While starting, images are pulling and services flip to running one by one —
  // poll so the user sees progress instead of a frozen button.
  const startPolling = () => {
    if (poll.current) window.clearInterval(poll.current);
    poll.current = window.setInterval(() => void refresh(), 3000);
    window.setTimeout(() => {
      if (poll.current) window.clearInterval(poll.current);
      poll.current = null;
    }, 20 * 60_000);
  };

  const start = async () => {
    setBusy("up");
    startPolling();
    try {
      setStatus(await stackUp());
    } finally {
      setBusy(null);
    }
  };
  const stop = async () => {
    setBusy("down");
    try {
      setStatus(await stackDown());
    } finally {
      setBusy(null);
    }
  };

  if (!canControlStack()) {
    return (
      <SettingGroup title="Local stack">
        <div className="px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-mute">
          One-click start is available in the desktop app. To run the stack yourself:
          <pre className="mt-2 overflow-x-auto rounded-control bg-field px-3 py-2 font-mono text-[12px] text-ink">
            cd services/selfhost{"\n"}cp .env.example .env{"\n"}docker compose up -d
          </pre>
        </div>
      </SettingGroup>
    );
  }

  if (status && !status.dockerAvailable) {
    return (
      <SettingGroup title="Local stack">
        <div className="flex items-start gap-2.5 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ink-mute" />
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-ink">Docker isn't installed</div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-mute">
              The stack runs the relay, LiveKit, and the AI model as containers, so Docker Desktop is
              required. Install it, then come back — no other setup needed.
            </p>
            <a
              href="https://www.docker.com/products/docker-desktop/"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink underline underline-offset-2"
            >
              Get Docker Desktop <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </SettingGroup>
    );
  }

  if (status && !status.daemonRunning) {
    return (
      <SettingGroup title="Local stack">
        <SettingRow
          label="Docker isn't running"
          desc="Docker is installed but its engine isn't started. Launch Docker Desktop, then refresh."
          control={
            <Button variant="ghost" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          }
        />
      </SettingGroup>
    );
  }

  const running = status?.running ?? false;

  return (
    <SettingGroup title="Local stack">
      <SettingRow
        label={running ? "Running" : "Stopped"}
        desc={
          running
            ? "Channels, calls, files, and the AI model are all running on this machine."
            : "Starts the relay, LiveKit, and Ollama as containers. The first start downloads a few GB, so it can take a while."
        }
        control={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={busy !== null}>
              <RefreshCw className={cn("size-4", busy && "animate-spin")} />
            </Button>
            {running ? (
              <Button variant="secondary" size="sm" onClick={() => void stop()} disabled={busy !== null}>
                <Square className="size-4" /> {busy === "down" ? "Stopping…" : "Stop"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => void start()} disabled={busy !== null}>
                <Play className="size-4" /> {busy === "up" ? "Starting…" : "Start local stack"}
              </Button>
            )}
          </div>
        }
      />

      {(status?.services.length ?? 0) > 0 && (
        <div className="space-y-1.5 px-4 py-3.5">
          {status!.services.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-[12.5px]">
              <CircleDot className={cn("size-3.5 shrink-0", s.running ? "text-positive" : "text-ink-faint")} />
              <span className="text-ink">{SERVICE_LABELS[s.name] ?? s.name}</span>
              <span className="ml-auto font-mono text-[11.5px] text-ink-faint">{s.state}</span>
            </div>
          ))}
        </div>
      )}

      {status?.error && (
        <div className="px-4 py-3.5">
          <pre className="overflow-x-auto rounded-control bg-field px-3 py-2 font-mono text-[11.5px] leading-relaxed text-negative">
            {status.error}
          </pre>
        </div>
      )}

      {running && (
        <SettingRow
          label="Use this relay"
          desc={`Point Umbry at the stack running on this machine (${status?.relayUrl ?? LOCAL_STACK_RELAY}).`}
          control={
            <Button variant="secondary" size="sm" onClick={() => onUseRelay(status?.relayUrl ?? LOCAL_STACK_RELAY)}>
              Use it
            </Button>
          }
        />
      )}
    </SettingGroup>
  );
}

export function SelfHostSettings() {
  const saved = getOverrides();
  const [mode, setModeState] = useState<HostMode>(getMode());
  const [relay, setRelay] = useState(saved.relayBase ?? "");
  const [gossip, setGossip] = useState(saved.gossipApiUrl ?? "");
  const [health, setHealth] = useState<Health>("unknown");
  // Native is the default: no Docker, no admin rights. Docker stays for people
  // standing up a shared box for their team.
  const [runtime, setRuntime] = useState<"native" | "docker">(canRunNative() ? "native" : "docker");

  const selfHosted = mode === "selfhosted";
  const modeChanged = mode !== getMode();
  const urlsChanged = relay.trim() !== (saved.relayBase ?? "") || gossip.trim() !== (saved.gossipApiUrl ?? "");
  const dirty = modeChanged || (selfHosted && urlsChanged);

  const check = useCallback(async (base: string) => {
    setHealth("checking");
    setHealth((await probe(base)) ? "ok" : "down");
  }, []);

  // Probe whatever relay the app is actually using on mount.
  useEffect(() => {
    void check(getMode() === "selfhosted" ? saved.relayBase || LOCAL_STACK_RELAY : defaults.relayBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => {
    if (selfHosted) setOverrides({ relayBase: relay, gossipApiUrl: gossip });
    setMode(mode);
    // Sockets, the workspace list, and the Gossip SDK's baked-in URL all key off
    // the endpoint — reload rather than pretend we can re-point them live.
    applyAndReload();
  };

  const useStackRelay = (url: string) => {
    setRelay(url);
    setModeState("selfhosted");
    void check(url);
  };

  return (
    <SettingsPage
      title="Self-hosting"
      desc="Choose where Umbry's infrastructure runs. Direct messages stay end-to-end encrypted over the decentralized Gossip network in every mode — this only decides who carries channels, calls, files, and AI."
    >
      <div className="flex gap-3 max-md:flex-col">
        <ModeCard
          active={!selfHosted}
          icon={Cloud}
          title="Managed"
          desc="Umbry's hosted relay. Nothing to run or maintain; AI is unavailable because the model can't run on our hardware for you."
          onClick={() => setModeState("managed")}
        />
        <ModeCard
          active={selfHosted}
          icon={HardDrive}
          title="Self-hosted"
          desc="Your own relay, LiveKit, and AI model. Nothing about your channels, calls, or files touches us."
          onClick={() => setModeState("selfhosted")}
        />
      </div>

      {selfHosted && (runtime === "native" ? <NativePanel onUseRelay={useStackRelay} /> : <StackPanel onUseRelay={useStackRelay} />)}

      {selfHosted && canRunNative() && (
        <button
          onClick={() => setRuntime((r) => (r === "native" ? "docker" : "native"))}
          className="self-start text-[12.5px] text-ink-faint underline underline-offset-2 hover:text-ink"
        >
          {runtime === "native"
            ? "Running a shared server for your team? Use Docker instead →"
            : "← Back to the built-in services (no Docker needed)"}
        </button>
      )}

      {selfHosted && (
        <SettingGroup title="Relay">
          <SettingRow
            label="Relay URL"
            desc="Base URL of your relay. Leave blank to use the local stack above."
          >
            <div className="mt-2.5 flex items-center gap-2">
              <Input
                value={relay}
                onChange={(e) => setRelay(e.target.value)}
                placeholder={LOCAL_STACK_RELAY}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="font-mono text-[13px]"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => check(relay.trim() || LOCAL_STACK_RELAY)}
                disabled={health === "checking"}
                className="shrink-0"
              >
                <RefreshCw className={cn("size-4", health === "checking" && "animate-spin")} /> Test
              </Button>
            </div>
          </SettingRow>
          <SettingRow
            label="Status"
            desc="Live reachability of the relay above."
            control={
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-control px-3 py-1.5 font-mono text-[12px]",
                  health === "ok" ? "bg-field text-positive" : "bg-field text-ink-faint",
                )}
              >
                <CircleDot className={cn("size-3.5", health === "ok" && "animate-pulse")} />
                {health === "checking"
                  ? "checking…"
                  : health === "ok"
                    ? "reachable"
                    : health === "down"
                      ? "unreachable"
                      : "—"}
              </span>
            }
          />
        </SettingGroup>
      )}

      {selfHosted && (
        <SettingGroup title="Direct messages (advanced)">
          <div className="flex items-start gap-2.5 px-4 py-3.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-positive" />
            <p className="text-[12.5px] leading-relaxed text-ink-mute">
              DMs are end-to-end encrypted over the decentralized Gossip network — there is nothing of
              ours in their path, so most self-hosters never change this. Override only if you run your
              own Gossip infrastructure.
            </p>
          </div>
          <SettingRow label="Gossip protocol URL" desc={`Default: ${defaults.gossipApiUrl}`}>
            <div className="mt-2.5">
              <Input
                value={gossip}
                onChange={(e) => setGossip(e.target.value)}
                placeholder={defaults.gossipApiUrl}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                className="font-mono text-[13px]"
              />
            </div>
          </SettingRow>
        </SettingGroup>
      )}

      {selfHosted && (
        <div className="flex items-start gap-2.5 rounded-card border border-line bg-paper-2 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-mute" />
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            For teammates to connect, the relay must be reachable from their machines — set{" "}
            <span className="font-mono text-ink">UMBRY_HOST</span> to your LAN IP or domain in{" "}
            <span className="font-mono text-ink">services/selfhost/.env</span>, otherwise calls will
            fail for everyone but you. Over the public internet it also needs{" "}
            <span className="font-medium text-ink">HTTPS</span>, since the encrypted-messaging WASM
            requires a secure context.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={apply} disabled={!dirty}>
          <Server className="size-4" /> Apply &amp; restart
        </Button>
        {dirty && (
          <span className="text-[12.5px] text-ink-mute">Umbry reloads to switch infrastructure.</span>
        )}
      </div>
    </SettingsPage>
  );
}
