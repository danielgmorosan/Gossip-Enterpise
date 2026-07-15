import { useState } from "react";
import { create } from "zustand";
import { Check, Fingerprint, Loader2, LockKeyhole } from "lucide-react";
import { Button, Field, PasswordInput, StackModal, ModalBody } from "@gossip/ui/stack";
import { useSession } from "@/stores/useSession";
import { validateMnemonic } from "@/lib/sdk";
import { hasBiometricVault, unlockBiometricVault } from "@/lib/biometricVault";
import { cn } from "@/lib/utils";

/**
 * In-place unlock (T3). Anywhere the app hits a locked session it can call
 * useUnlockPrompt.getState().show() — the user unlocks in a popup and stays
 * exactly where they were, instead of being bounced to /identity/unlock.
 */
export const useUnlockPrompt = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

export function UnlockDialog() {
  const open = useUnlockPrompt((s) => s.open);
  const { hide } = useUnlockPrompt.getState();
  const [passphrase, setPassphrase] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const bioUnlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const phrase = await unlockBiometricVault();
      const ok = await useSession.getState().unlock(phrase);
      if (ok) hide();
      else setError("Couldn't open a session. Check your connection and try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Biometric unlock failed.");
    } finally {
      setBusy(false);
    }
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
    const ok = await useSession.getState().unlock(phrase, remember);
    setBusy(false);
    if (ok) {
      setPassphrase("");
      hide();
    } else {
      setError("Couldn't open a session. Check your connection and try again.");
    }
  };

  return (
    <StackModal onClose={hide} width="md">
      <ModalBody>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-control bg-field text-ink">
            <LockKeyhole className="size-4.5" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">Unlock your session</h2>
            <p className="text-[12.5px] text-ink-mute">Your keys never leave this device.</p>
          </div>
        </div>
        {hasBiometricVault() && (
          <Button variant="secondary" block className="mb-4" disabled={busy} onClick={() => void bioUnlock()}>
            <Fingerprint className="size-4" /> Unlock with biometrics
          </Button>
        )}
        <form onSubmit={submit} className="space-y-4">
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
                Stores your passphrase in this browser so the app opens unlocked. Turn off in Settings → Security.
              </span>
            </span>
          </label>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" block disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Opening session…</> : "Unlock"}
          </Button>
        </form>
      </ModalBody>
    </StackModal>
  );
}
