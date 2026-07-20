import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Check, Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { Field, PasswordInput, Button, LabeledDivider, textLinkClass } from "@umbry/ui/stack";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/useSession";
import { useRelay } from "@/stores/useRelay";
import { validateMnemonic } from "@/lib/sdk";
import { peekPendingInvite } from "@/lib/invite";
import { hasBiometricVault, unlockBiometricVault } from "@/lib/biometricVault";
import { hasPasswordVault, unlockPasswordVault } from "@/lib/passwordVault";
import { QuickUnlockStep } from "@/components/QuickUnlockStep";

export function IdentityUnlock() {
  const nav = useNavigate();
  const unlock = useSession((s) => s.unlock);
  const [passphrase, setPassphrase] = useState("");
  const [pwInput, setPwInput] = useState("");
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

  const [quickOffer, setQuickOffer] = useState<string | null>(null);

  const hasVault = hasBiometricVault();
  const hasPw = hasPasswordVault();
  // When a quick-unlock is enrolled it's the fast path - lead with it and keep
  // the (rarely-on-hand) 12-word phrase as the fallback below. Declared here
  // (before any early return) so hook order stays stable when the post-unlock
  // quick-unlock offer swaps the rendered tree.
  const [showPhrase, setShowPhrase] = useState(!hasVault && !hasPw);

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
    // First passphrase login with no quick-unlock yet: offer to set one up
    // (biometrics where supported, else a password) before entering the app.
    if (!hasBiometricVault() && !hasPasswordVault()) setQuickOffer(phrase);
    else goToApp();
  };

  if (quickOffer) {
    return (
      <QuickUnlockStep mnemonic={quickOffer} displayName={useSession.getState().displayName} onDone={goToApp} />
    );
  }

  const bioUnlock = async () => {
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
  };

  const pwUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const phrase = await unlockPasswordVault(pwInput);
      const ok = await unlock(phrase, remember);
      if (ok) goToApp();
      else setError("Couldn't open a session. Check your connection and try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setBusy(false);
    }
  };

  const hasQuick = hasVault || hasPw;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1.5 text-[14px] text-ink-mute">
          {hasVault
            ? "Unlock with your biometrics to continue"
            : hasPw
              ? "Enter your unlock password to continue"
              : "Enter your recovery passphrase to unlock"}
        </p>
      </div>

      {error && hasQuick && <p className="mb-3 text-sm text-negative">{error}</p>}

      {hasVault && (
        <Button block size="lg" disabled={busy} onClick={() => void bioUnlock()}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Opening session…
            </>
          ) : (
            <>
              <Fingerprint className="size-5" /> Unlock with biometrics
            </>
          )}
        </Button>
      )}

      {hasPw && (
        <form onSubmit={pwUnlock} className={cn("space-y-3", hasVault && "mt-4")}>
          {hasVault && <LabeledDivider label="or use your unlock password" className="my-1" />}
          <PasswordInput
            placeholder="Unlock password"
            autoFocus={!hasVault}
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            invalid={!!error}
          />
          <Button block size="lg" type="submit" variant={hasVault ? "secondary" : "primary"} disabled={busy || !pwInput}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Opening session…
              </>
            ) : (
              <>
                <KeyRound className="size-5" /> Unlock
              </>
            )}
          </Button>
        </form>
      )}

      {hasQuick &&
        (!showPhrase ? (
          <button
            type="button"
            onClick={() => setShowPhrase(true)}
            className="mt-4 block w-full text-center text-[13px] text-ink-mute underline underline-offset-2 hover:text-ink"
          >
            Use your recovery passphrase instead
          </button>
        ) : (
          <LabeledDivider label="or use your recovery phrase" className="my-6" />
        ))}

      {showPhrase && (
        <form onSubmit={submit} className="space-y-5">
          <Field label="Passphrase" hint="Your 12-word BIP39 recovery phrase.">
            <PasswordInput
              placeholder="word word word …"
              autoFocus={!hasQuick}
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
          {!hasQuick && error && <p className="text-sm text-negative">{error}</p>}
          <Button block size="lg" type="submit" variant={hasQuick ? "secondary" : "primary"} disabled={busy}>
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
      )}

      <p className="mt-6 text-center text-[14px] text-ink-mute">
        Use a different identity?{" "}
        <Link to="/welcome" className={textLinkClass}>
          Start over
        </Link>
      </p>
    </div>
  );
}
