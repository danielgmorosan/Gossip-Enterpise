import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Fingerprint, Loader2 } from "lucide-react";
import { Field, PasswordInput, Button, LabeledDivider, textLinkClass } from "@gossip/ui/stack";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";
import { validateMnemonic } from "@/lib/sdk";

export function IdentityUnlock() {
  const nav = useNavigate();
  const unlock = useSession((s) => s.unlock);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToApp = () => {
    const mine = useRelay.getState().myWorkspaces;
    nav(mine.length > 0 ? `/w/${mine[0].id}` : "/workspace/create");
  };

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
    if (ok) goToApp();
    else setError("Couldn't open a session. Check your connection and try again.");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1.5 text-[14px] text-ink-mute">Enter your recovery passphrase to unlock</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Field label="Passphrase" hint="Your 12-word BIP39 recovery phrase.">
          <PasswordInput
            placeholder="word word word …"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            invalid={!!error}
          />
        </Field>
        {error && <p className="text-sm text-negative">{error}</p>}
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

      <LabeledDivider label="or" className="my-6" />

      <button
        type="button"
        disabled
        title="Available on the desktop/mobile build"
        className="flex w-full items-center justify-center gap-2.5 rounded-control border border-line bg-field py-3 text-[14px] font-medium text-ink-mute opacity-60"
      >
        <Fingerprint className="size-5" /> Unlock with biometrics
      </button>

      <p className="mt-6 text-center text-[14px] text-ink-mute">
        Use a different identity?{" "}
        <Link to="/welcome" className={textLinkClass}>
          Start over
        </Link>
      </p>
    </div>
  );
}
