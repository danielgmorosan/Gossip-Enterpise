import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { Button, Field, Input } from "@gossip/ui";
import { GossipMark } from "@gossip/ui";
import { useSession } from "@/stores/useSession";
import { validateMnemonic } from "@/lib/sdk";

export function IdentityUnlock() {
  const nav = useNavigate();
  const unlock = useSession((s) => s.unlock);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phrase = passphrase.trim();
    if (!validateMnemonic(phrase)) {
      setError("That doesn't look like a valid 12-word recovery passphrase.");
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await unlock(phrase);
    setBusy(false);
    if (ok) nav("/w/w_gossip/c/c_design");
    else setError("Couldn't open a session. Check your connection and try again.");
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center text-center">
        <GossipMark size={56} className="glow-accent" />
        <h2 className="mt-4 font-display text-[26px] font-bold tracking-tight text-text">Welcome back</h2>
        <p className="mt-1 font-mono text-[12px] text-faint">Enter your recovery passphrase to unlock</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Passphrase" hint="Your 12-word BIP39 recovery phrase.">
          <Input
            type="password"
            placeholder="word word word …"
            icon={<KeyRound />}
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </Field>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <Button block size="lg" type="submit" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Opening session…
            </>
          ) : (
            <>
              Unlock <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-faint">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        disabled
        title="Available on the desktop/mobile build"
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-raised py-3 text-[14px] font-medium text-muted opacity-60"
      >
        <Fingerprint className="size-5 text-accent" /> Unlock with biometrics
      </button>

      <p className="mt-6 text-center text-[13px] text-muted">
        Use a different identity?{" "}
        <Link to="/welcome" className="font-medium text-accent hover:underline">
          Start over
        </Link>
      </p>
    </div>
  );
}
