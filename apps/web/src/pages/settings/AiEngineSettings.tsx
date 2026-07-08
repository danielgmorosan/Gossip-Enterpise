import { useCallback, useEffect, useState } from "react";
import { Cpu, Check, Copy, CircleDot, ShieldCheck, RefreshCw } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button } from "@gossip/ui/stack";
import { aiHealth, type AiHealth } from "@/lib/ai";
import { ollamaModels } from "@/data/mock";
import { cn } from "@/lib/utils";

export function AiEngineSettings() {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await aiHealth());
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const copyPull = (id: string) => {
    navigator.clipboard?.writeText(`ollama pull ${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <SettingsPage
      title="AI Engine"
      desc="Run Gossip AI on a local open-source model so sensitive reasoning never leaves your machines. Cloud is an opt-in route for higher quality."
    >
      {/* Desktop notice */}
      <div className="flex items-start gap-3 rounded-card border border-line bg-paper-2 p-4">
        <Cpu className="mt-0.5 size-5 shrink-0 text-ink-mute" />
        <p className="text-[13px] leading-relaxed text-ink-mute">
          <span className="font-medium text-ink">One-click local install lands with the desktop app.</span>{" "}
          On the web build, this page shows the live engine status and the commands to run yourself.
        </p>
      </div>

      <SettingGroup title="Engine status">
        <SettingRow
          label="Ollama"
          desc="Local inference server at 127.0.0.1:11434."
          control={
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-control px-3 py-1.5 font-mono text-[12px]",
                  health?.ollama ? "bg-field text-positive" : "bg-field text-ink-faint",
                )}
              >
                <CircleDot className={cn("size-3.5", health?.ollama && "animate-pulse")} />
                {health === null ? "gateway unreachable" : health.ollama ? "running" : "not detected"}
              </span>
              <Button variant="ghost" size="sm" onClick={check} disabled={checking}>
                <RefreshCw className={cn("size-4", checking && "animate-spin")} /> Re-check
              </Button>
            </div>
          }
        />
        <SettingRow
          label="Model"
          desc={
            health && health.ollama && !health.hasModel
              ? `Configured model isn't pulled yet — run \`ollama pull ${health.model}\`.`
              : "The model Gossip AI routes reasoning to."
          }
          control={
            <span className={cn("font-mono text-[12px]", health?.ok ? "text-ink" : "text-ink-faint")}>
              {health ? `${health.model} · ${health.route}` : "—"}
            </span>
          }
        />
        {health && !health.ollama && (
          <div className="px-4 py-3 font-mono text-[12px] text-ink-mute">
            $ ollama serve
          </div>
        )}
      </SettingGroup>

      <SettingGroup title="Curated models">
        {ollamaModels.map((m) => (
          <SettingRow
            key={m.id}
            label={
              <span className="flex items-center gap-2">
                <span className="font-mono text-[13px]">{m.id}</span>
                {m.recommended && (
                  <span className="rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-ink">recommended</span>
                )}
              </span>
            }
            desc={`${m.tier} · ${m.ram} · ${m.ctx} — ${m.desc}`}
            control={
              <Button variant="outline" size="sm" onClick={() => copyPull(m.id)}>
                {copiedId === m.id ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
                {copiedId === m.id ? "Copied" : "Copy pull command"}
              </Button>
            }
          />
        ))}
      </SettingGroup>

      <SettingGroup title="Cloud route · Claude (opt-in)">
        <div className="flex items-start gap-2.5 px-4 py-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-positive" />
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            The Anthropic API key lives in the gateway config (<span className="font-mono text-ink">services/relay/.env</span>),
            never in the frontend bundle. Privacy-sensitive jobs stay pinned to the local route.
          </p>
        </div>
      </SettingGroup>
    </SettingsPage>
  );
}
