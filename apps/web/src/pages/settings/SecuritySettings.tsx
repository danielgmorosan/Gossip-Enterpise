import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fingerprint, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button } from "@gossip/ui/stack";
import { useSession } from "@/stores/useSession";
import {
  biometricsAvailable,
  enrollBiometricVault,
  hasBiometricVault,
  removeBiometricVault,
} from "@/lib/biometricVault";

export function SecuritySettings() {
  const nav = useNavigate();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const remembered = useSession((s) => s.remembered);
  const forgetDevice = useSession((s) => s.forgetDevice);
  const mnemonic = useSession((s) => s.mnemonic);
  const displayName = useSession((s) => s.displayName);

  // Biometric vault (T3): Windows Hello / Touch ID / device PIN unlock.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(hasBiometricVault());
  const [bioBusy, setBioBusy] = useState(false);
  const [bioMsg, setBioMsg] = useState<string | null>(null);
  useEffect(() => {
    void biometricsAvailable().then(setBioAvailable);
  }, []);

  const enrollBio = async () => {
    if (!mnemonic) {
      setBioMsg("Unlock with your passphrase once in this tab, then enable biometrics.");
      return;
    }
    setBioBusy(true);
    setBioMsg(null);
    try {
      const mode = await enrollBiometricVault(mnemonic, displayName);
      setBioEnrolled(true);
      setBioMsg(
        mode === "prf"
          ? "Done - hardware-bound (PRF). Next unlock is one fingerprint/PIN away."
          : "Done - biometric-gated mode (this browser can't do PRF, but nothing is stored in plaintext). Next unlock is one fingerprint/PIN away.",
      );
    } catch (e) {
      setBioMsg(e instanceof Error ? e.message : "Couldn't set up biometric unlock.");
    } finally {
      setBioBusy(false);
    }
  };

  const lock = async () => {
    await signOut();
    nav("/identity/unlock");
  };

  return (
    <SettingsPage title="Security" desc="Your keys, your sessions, your device locks.">
      <SettingGroup title="Encryption">
        <SettingRow
          label={
            <span className="flex items-center gap-2">
              Post-quantum E2E
              <span className="inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
                <span className="size-1.5 rounded-full bg-positive" /> active
              </span>
            </span>
          }
          desc="DMs use post-quantum key exchange with ephemeral per-message keys (forward secrecy). This is sealed and not configurable."
          control={<ShieldCheck className="size-6 text-positive" />}
        />
      </SettingGroup>

      <SettingGroup title="Session">
        <SettingRow
          label={
            <span className="flex items-center gap-2">
              Biometric unlock
              {bioEnrolled && (
                <span className="inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
                  <span className="size-1.5 rounded-full bg-positive" /> on
                </span>
              )}
            </span>
          }
          desc={
            bioMsg ??
            (bioEnrolled
              ? "Unlock with Windows Hello / Touch ID / device PIN. Your passphrase is stored encrypted - only your biometric gesture can decrypt it."
              : bioAvailable
                ? "Encrypt your passphrase behind Windows Hello / Touch ID / your device PIN. One touch to unlock, nothing stored in plaintext."
                : "No platform authenticator found - set up Windows Hello (or your device's biometrics/PIN) first.")
          }
          control={
            bioEnrolled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  removeBiometricVault();
                  setBioEnrolled(false);
                  setBioMsg(null);
                }}
              >
                Remove
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => void enrollBio()} disabled={!bioAvailable || bioBusy || status !== "open"}>
                {bioBusy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />} Enable
              </Button>
            )
          }
        />
        <SettingRow
          label="Stay unlocked on this device"
          desc={
            remembered
              ? "Your passphrase is stored in this browser so the app opens unlocked. Forgetting it means unlocking manually after every reload."
              : "Off - you unlock manually after each reload. Tick “Keep me unlocked” next time you unlock to turn it on."
          }
          control={
            <Button variant="secondary" size="sm" onClick={forgetDevice} disabled={!remembered}>
              Forget this device
            </Button>
          }
        />
        <SettingRow
          label="Lock this session"
          desc="Closes your encrypted session on this device. You'll re-unlock with your recovery passphrase."
          control={
            <Button variant="danger" size="sm" onClick={lock} disabled={status !== "open"}>
              <KeyRound className="size-4" /> Lock session
            </Button>
          }
        />
      </SettingGroup>
    </SettingsPage>
  );
}
