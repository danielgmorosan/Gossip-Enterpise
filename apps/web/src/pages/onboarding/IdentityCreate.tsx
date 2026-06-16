import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, RefreshCw, Check, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@gossip/ui";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/useSession";

export function IdentityCreate() {
  const nav = useNavigate();
  const createIdentity = useSession((s) => s.createIdentity);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  // Generate a real BIP39 mnemonic once on mount (stored in the session store).
  const [mnemonic, setMnemonic] = useState(() => createIdentity());
  const WORDS = mnemonic.split(/\s+/);

  const copy = () => {
    navigator.clipboard?.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const regenerate = () => {
    setMnemonic(createIdentity());
    setSaved(false);
  };

  return (
    <div>
      <Link to="/welcome" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Step 1 of 2 · Identity</div>
      <h2 className="mt-1 font-display text-[28px] font-bold tracking-tight text-text">
        Your recovery passphrase
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
        This 12-word phrase <span className="text-text">is</span> your identity. There's no email to
        reset it — write it down and keep it offline.
      </p>

      <div className="relative mt-6">
        <div className={cn("grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface-inset p-3", !revealed && "blur-sm select-none")}>
          {WORDS.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2">
              <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-mono text-[13px] text-text">{w}</span>
            </div>
          ))}
        </div>
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="absolute inset-0 grid place-items-center rounded-2xl"
          >
            <span className="inline-flex items-center gap-2 rounded-xl bg-surface-raised px-4 py-2 text-[13px] font-medium text-text shadow-lg ring-1 ring-border">
              <Eye className="size-4" /> Tap to reveal
            </span>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)}>
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {revealed ? "Hide" : "Reveal"}
        </Button>
        <Button variant="ghost" size="sm" onClick={copy} disabled={!revealed}>
          {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" disabled={!revealed} onClick={regenerate}>
          <RefreshCw className="size-4" /> Regenerate
        </Button>
      </div>

      <div className="mt-4 rounded-xl bg-[color:var(--accent-faint)] p-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-[12.5px] leading-relaxed text-muted">
            Your handle <span className="font-mono text-text">gossip34ngsdf9n…l8dhuj</span> is derived
            from this phrase. We never see it.
          </p>
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5">
        <button
          type="button"
          onClick={() => setSaved((v) => !v)}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
            saved ? "border-accent bg-accent text-accent-ink" : "border-border-strong",
          )}
        >
          {saved && <Check className="size-3.5" />}
        </button>
        <span className="text-[13px] text-muted">
          I've saved my recovery passphrase somewhere safe. I understand it cannot be recovered.
        </span>
      </label>

      <Button block size="lg" className="mt-6" disabled={!saved || !revealed} onClick={() => nav("/workspace/create")}>
        Continue <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
