import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { Button, Field, PasswordInput, LabeledDivider } from "@umbry/ui/stack";
import { biometricsAvailable, enrollBiometricVault } from "@/lib/biometricVault";
import { enrollPasswordVault, MIN_PASSWORD_LENGTH } from "@/lib/passwordVault";

/**
 * Onboarding quick-unlock offer: shown right after the first successful unlock
 * (create or returning) when no vault exists yet. Offers biometrics where the
 * platform supports it AND an unlock password everywhere — so Windows/Linux
 * desktop users (no WebAuthn platform authenticator in Electron) still get a
 * fast unlock instead of retyping the 12-word phrase. Enrolling here beats
 * burying it in Settings — most people never find it there.
 */
export function QuickUnlockStep({
  mnemonic,
  displayName,
  onDone,
}: {
  mnemonic: string;
  displayName: string;
  /** Called when a method is set up OR the user skips. */
  onDone: () => void;
}) {
  const [bioAvail, setBioAvail] = useState(false);
  const [busy, setBusy] = useState<null | "bio" | "pw">(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void biometricsAvailable().then(setBioAvail);
  }, []);

  const enrollBio = async () => {
    setBusy("bio");
    setError(null);
    try {
      await enrollBiometricVault(mnemonic, displayName);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set up biometric unlock.");
      setBusy(null);
    }
  };

  const enrollPw = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy("pw");
    setError(null);
    try {
      await enrollPasswordVault(mnemonic, password);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set the unlock password.");
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">One more thing</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Set up a quick unlock</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-mute">
        So you don't have to type the 12-word passphrase every time on this device. You'll still need
        the passphrase anywhere else — keep it safe.
      </p>

      <div className="mt-5 rounded-card bg-field p-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-mute" />
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            Your passphrase is encrypted on this device and only opens after your gesture or password.
            Nothing is stored in plaintext. Remove it any time in Settings → Security.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 text-[13px] text-negative">{error}</p>}

      {bioAvail && (
        <>
          <Button block size="lg" className="mt-6" disabled={busy !== null} onClick={() => void enrollBio()}>
            {busy === "bio" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Waiting for your device…
              </>
            ) : (
              <>
                <Fingerprint className="size-5" /> Enable biometric unlock
              </>
            )}
          </Button>
          <LabeledDivider label="or set an unlock password" className="my-5" />
        </>
      )}

      <div className={bioAvail ? "" : "mt-6"}>
        <Field label="Unlock password" hint={`At least ${MIN_PASSWORD_LENGTH} characters. Used only on this device.`}>
          <PasswordInput
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <div className="mt-3">
          <Field label="Confirm password">
            <PasswordInput
              placeholder="Re-enter the password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <Button
          block
          size="lg"
          variant={bioAvail ? "secondary" : "primary"}
          className="mt-4"
          disabled={busy !== null || !password || !confirm}
          onClick={() => void enrollPw()}
        >
          {busy === "pw" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Setting up…
            </>
          ) : (
            <>
              <KeyRound className="size-5" /> Set unlock password
            </>
          )}
        </Button>
      </div>

      <Button block variant="ghost" className="mt-2" disabled={busy !== null} onClick={onDone}>
        Skip for now
      </Button>
    </div>
  );
}
