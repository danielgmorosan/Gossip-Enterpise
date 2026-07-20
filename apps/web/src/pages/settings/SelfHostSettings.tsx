import { useCallback, useEffect, useState } from "react";
import { Server, ShieldCheck, CircleDot, RefreshCw, Lock } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, Input } from "@umbry/ui/stack";
import { cn } from "@/lib/utils";
import { defaults, getOverrides, setOverrides, clearOverrides } from "@/lib/endpoints";

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

export function SelfHostSettings() {
  const saved = getOverrides();
  const [relay, setRelay] = useState(saved.relayBase ?? "");
  const [gossip, setGossip] = useState(saved.gossipApiUrl ?? "");
  const [health, setHealth] = useState<Health>("unknown");
  const [savedFlash, setSavedFlash] = useState(false);

  const custom = Boolean((saved.relayBase ?? "").length || (saved.gossipApiUrl ?? "").length);
  const dirty = (relay.trim() !== (saved.relayBase ?? "")) || (gossip.trim() !== (saved.gossipApiUrl ?? ""));

  const check = useCallback(async (base: string) => {
    setHealth("checking");
    setHealth((await probe(base)) ? "ok" : "down");
  }, []);

  // Probe whatever relay the app is actually using on mount (custom or managed).
  useEffect(() => {
    void check(saved.relayBase ?? defaults.relayBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    setOverrides({ relayBase: relay, gossipApiUrl: gossip });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    void check(relay.trim() || defaults.relayBase);
  };

  const reset = () => {
    clearOverrides();
    setRelay("");
    setGossip("");
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
    void check(defaults.relayBase);
  };

  return (
    <SettingsPage
      title="Self-hosting"
      desc="Point Umbry at infrastructure you control. Your relay carries channels, calls, files, and AI; nothing about them touches us. Direct messages stay end-to-end encrypted in every mode."
    >
      {/* Mode banner */}
      <div className="flex items-start gap-3 rounded-card border border-line bg-paper-2 p-4">
        <Server className="mt-0.5 size-5 shrink-0 text-ink-mute" />
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink">
            {custom ? "Custom — running on your infrastructure" : "Managed — Umbry's hosted relay"}
          </div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-mute">
            {custom
              ? "Channels, calls, files, and AI ride your own relay. Reset below to return to the managed setup."
              : "Channels, calls, files, and AI run on Umbry's infrastructure. Enter your relay URL below to move them onto your own box."}
          </p>
        </div>
      </div>

      <SettingGroup title="Relay">
        <SettingRow
          label="Relay URL"
          desc="Base URL of your self-hosted relay (services/relay), e.g. https://relay.your-team.com. Leave blank to use the managed relay."
        >
          <div className="mt-2.5 flex items-center gap-2">
            <Input
              value={relay}
              onChange={(e) => setRelay(e.target.value)}
              placeholder={defaults.relayBase || "https://relay.your-team.com"}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="font-mono text-[13px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => check(relay.trim() || defaults.relayBase)}
              disabled={health === "checking"}
              className="shrink-0"
            >
              <RefreshCw className={cn("size-4", health === "checking" && "animate-spin")} /> Test
            </Button>
          </div>
        </SettingRow>
        <SettingRow
          label="Status"
          desc="Live reachability of the relay Umbry is set to use."
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

      <SettingGroup title="Direct messages (advanced)">
        <div className="flex items-start gap-2.5 px-4 py-3.5">
          <Lock className="mt-0.5 size-4 shrink-0 text-positive" />
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            DMs are end-to-end encrypted over the decentralized Gossip network — there is nothing of
            ours in their path, so most self-hosters never change this. Override the protocol endpoint
            only if you run your own Gossip infrastructure. Takes effect after a reload.
          </p>
        </div>
        <SettingRow label="Gossip protocol URL" desc={`Managed default: ${defaults.gossipApiUrl}`}>
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

      {/* Reachability caveat — the honest note, not hidden. */}
      <div className="flex items-start gap-2.5 rounded-card border border-line bg-paper-2 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-mute" />
        <p className="text-[12.5px] leading-relaxed text-ink-mute">
          Your relay must be reachable over <span className="font-medium text-ink">HTTPS</span> (the
          encrypted messaging WASM requires a secure context) and must allow this app's origin
          (<span className="font-mono text-ink">CORS_ORIGIN</span> in the relay's env). Teammates you
          invite from a self-hosted relay connect to it automatically.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty}>
          Save
        </Button>
        <Button variant="ghost" onClick={reset} disabled={!custom && !dirty}>
          Reset to managed
        </Button>
        {savedFlash && <span className="text-[12.5px] text-positive">Saved · reload to apply everywhere</span>}
      </div>
    </SettingsPage>
  );
}
