import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, RefreshCw, Check, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, Field, Input } from "@umbry/ui/stack";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/useSession";
import { BiometricEnrollStep } from "@/components/BiometricEnrollStep";
import { biometricsAvailable, hasBiometricVault } from "@/lib/biometricVault";

export function IdentityCreate() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") === "join" ? "/workspace/join" : "/workspace/create";
  const { createIdentity, unlock, setDisplayName } = useSession();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Generate a real BIP39 mnemonic once on mount (stored in the session store).
  const [mnemonic, setMnemonic] = useState(() => createIdentity());
  const WORDS = mnemonic.split(/\s+/);

  const [bioOffer, setBioOffer] = useState(false);

  const cont = async () => {
    setDisplayName(name.trim());
    setBusy(true);
    setError(null);
    // Remember the device by default (T3): otherwise every refresh re-locks
    // the session - which also dropped the user's avatar from calls (rejoins
    // as a guest with no identity). Turn off in Settings → Security.
    const ok = await unlock(mnemonic, true);
    setBusy(false);
    if (!ok) {
      setError("Couldn't open a session. Check your connection and try again.");
      return;
    }
    // Offer biometric unlock right here (T4): the device supports it and no
    // vault exists yet - way more discoverable than Settings → Security.
    if (!hasBiometricVault() && (await biometricsAvailable())) setBioOffer(true);
    else nav(next);
  };

  if (bioOffer) {
    return <BiometricEnrollStep mnemonic={mnemonic} displayName={name.trim()} onDone={() => nav(next)} />;
  }

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
      <Link to="/welcome" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-mute hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Step 1 of 2 · Identity</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
        Your recovery passphrase
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-mute">
        This 12-word phrase <span className="text-ink">is</span> your identity. There's no email to
        reset it, so write it down and keep it offline.
      </p>

      <div className="mt-5">
        <Field label="Your name" hint="Shown to others in group channels.">
          <Input placeholder="e.g. Daniel" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>

      <div className="relative mt-6">
        <div className={cn("grid grid-cols-3 gap-2 rounded-card border border-line bg-field p-3", !revealed && "blur-sm select-none")}>
          {WORDS.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-control bg-paper px-2.5 py-2">
              <span className="font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-mono text-[13px] text-ink">{w}</span>
            </div>
          ))}
        </div>
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="absolute inset-0 grid place-items-center rounded-card"
          >
            <span className="inline-flex items-center gap-2 rounded-control bg-paper px-4 py-2 text-[13px] font-medium text-ink shadow-[var(--st-shadow-card)] ring-1 ring-line">
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
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" disabled={!revealed} onClick={regenerate}>
          <RefreshCw className="size-4" /> Regenerate
        </Button>
      </div>

      <div className="mt-4 rounded-card bg-field p-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-mute" />
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            Your handle <span className="font-mono text-ink">gossip34ngsdf9n…l8dhuj</span> is derived
            from this phrase. We never see it.
          </p>
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5">
        <button
          type="button"
          onClick={() => setSaved((v) => !v)}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors",
            saved ? "border-ink bg-ink text-paper" : "border-line-strong",
          )}
        >
          {saved && <Check className="size-3.5" />}
        </button>
        <span className="text-[13px] text-ink-mute">
          I've saved my recovery passphrase somewhere safe. I understand it cannot be recovered.
        </span>
      </label>

      {error && <p className="mt-4 text-[13px] text-negative">{error}</p>}

      <Button block size="lg" className="mt-6" disabled={!saved || !revealed || !name.trim() || busy} onClick={cont}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Creating your identity…
          </>
        ) : (
          <>
            Continue <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </div>
  );
}
