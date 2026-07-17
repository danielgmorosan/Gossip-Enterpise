import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Check, Fingerprint, Loader2 } from "lucide-react";
import { Field, PasswordInput, Button, LabeledDivider, textLinkClass } from "@umbry/ui/stack";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";
import { validateMnemonic } from "@/lib/sdk";
import { peekPendingInvite } from "@/lib/invite";
import { biometricsAvailable, hasBiometricVault, unlockBiometricVault } from "@/lib/biometricVault";
import { BiometricEnrollStep } from "@/components/BiometricEnrollStep";

export function IdentityUnlock() {
  const nav = useNavigate();
  const unlock = useSession((s) => s.unlock);
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToApp = () => {
    if (peekPendingInvite()) {
      nav("/workspace/join"); // invite link pending - finish the join, prefilled
      return;
    }
    // No workspace? DMs still work - land in the personal home space.
    const mine = useRelay.getState().myWorkspaces;
    nav(mine.length > 0 ? `/w/${mine[0].id}` : "/home");
  };

  const [bioOffer, setBioOffer] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phrase = passphrase.trim();
    if (!validateMnemonic(phrase)) {
      setError("That doesn't look like a valid 12-word recovery passphrase.");
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await unlock(phrase, remember);
    setBusy(false);
    if (!ok) {
      setError("Couldn't open a session. Check your connection and try again.");
      return;
    }
    // First passphrase login on a biometrics-capable device: offer enrollment
    // before entering the app (T4).
    if (!hasBiometricVault() && (await biometricsAvailable())) setBioOffer(phrase);
    else goToApp();
  };

  if (bioOffer) {
    return (
      <BiometricEnrollStep
        mnemonic={bioOffer}
        displayName={useSession.getState().displayName}
        onDone={goToApp}
      />
    );
  }

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
        <label className="flex cursor-pointer items-start gap-2.5">
          <button
            type="button"
            onClick={() => setRemember((v) => !v)}
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border transition-colors",
              remember ? "border-ink bg-ink text-paper" : "border-line-strong",
            )}
          >
            {remember && <Check className="size-3.5" />}
          </button>
          <span className="text-[13px] leading-snug text-ink-mute">
            Keep me unlocked on this device
            <span className="block text-[11.5px] text-ink-faint">
              Stores your passphrase in this browser so reloads don't lock you out. Turn off in Settings → Security.
            </span>
          </span>
        </label>
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
        disabled={!hasBiometricVault() || busy}
        title={hasBiometricVault() ? "Windows Hello / Touch ID / device PIN" : "Enable in Settings → Security after unlocking"}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const phrase = await unlockBiometricVault();
            const ok = await unlock(phrase);
            if (ok) goToApp();
            else setError("Couldn't open a session. Check your connection and try again.");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Biometric unlock failed.");
          } finally {
            setBusy(false);
          }
        }}
        className="flex w-full items-center justify-center gap-2.5 rounded-control border border-line bg-field py-3 text-[14px] font-medium text-ink transition-colors enabled:hover:border-line-strong disabled:text-ink-mute disabled:opacity-60"
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
