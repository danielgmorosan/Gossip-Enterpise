import { useState } from "react";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@umbry/ui/stack";
import { enrollBiometricVault } from "@/lib/biometricVault";

/**
 * Onboarding biometrics offer: shown right after the first successful
 * unlock (create or returning) when the device has a platform authenticator
 * and no vault yet. Enrolling here beats burying it in Settings → Security -
 * most people never find it there.
 */
export function BiometricEnrollStep({
  mnemonic,
  displayName,
  onDone,
}: {
  mnemonic: string;
  displayName: string;
  /** Called when enrollment finishes OR the user skips. */
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enroll = async () => {
    setBusy(true);
    setError(null);
    try {
      await enrollBiometricVault(mnemonic, displayName);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set up biometric unlock.");
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">One more thing</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Unlock with a fingerprint?</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-mute">
        Add Windows Hello, Touch ID, or your device PIN so you don't have to type the 12-word
        passphrase on this device. You'll still need the passphrase anywhere else - keep it safe.
      </p>

      <div className="mt-5 rounded-card bg-field p-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-mute" />
          <p className="text-[12.5px] leading-relaxed text-ink-mute">
            The passphrase is encrypted on this device and only opens after a verified gesture.
            You can remove it any time in Settings → Security.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 text-[13px] text-negative">{error}</p>}

      <Button block size="lg" className="mt-6" disabled={busy} onClick={() => void enroll()}>
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Waiting for your device…
          </>
        ) : (
          <>
            <Fingerprint className="size-5" /> Enable biometric unlock
          </>
        )}
      </Button>
      <Button block variant="ghost" className="mt-2" disabled={busy} onClick={onDone}>
        Skip for now
      </Button>
    </div>
  );
}
