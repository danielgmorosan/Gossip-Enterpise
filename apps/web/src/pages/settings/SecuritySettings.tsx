import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fingerprint, KeyRound, Loader2, Lock, ShieldCheck, UserPlus } from "lucide-react";
import { SettingsPage } from "./SettingsLayout";
import { SettingGroup, SettingRow } from "./parts";
import { Button, PasswordInput } from "@umbry/ui/stack";
import { ConfirmDialog } from "@/components/ContextMenu";
import { useSession } from "@/stores/useSession";
import {
  biometricsAvailable,
  enrollBiometricVault,
  hasBiometricVault,
  removeBiometricVault,
} from "@/lib/biometricVault";
import {
  enrollPasswordVault,
  hasPasswordVault,
  MIN_PASSWORD_LENGTH,
  removePasswordVault,
} from "@/lib/passwordVault";

export function SecuritySettings() {
  const nav = useNavigate();
  const status = useSession((s) => s.status);
  const signOut = useSession((s) => s.signOut);
  const startFresh = useSession((s) => s.startFresh);
  const [showSwitch, setShowSwitch] = useState(false);
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
          : mode === "native"
            ? "Done - your passphrase is sealed in the macOS keychain and released by Touch ID. Next unlock is one touch away."
            : "Done - biometric-gated mode (this browser can't do PRF, but nothing is stored in plaintext). Next unlock is one fingerprint/PIN away.",
      );
    } catch (e) {
      setBioMsg(e instanceof Error ? e.message : "Couldn't set up biometric unlock.");
    } finally {
      setBioBusy(false);
    }
  };

  // Password unlock vault: the universal quick-unlock (works everywhere, incl.
  // the Windows/Linux desktop app where no platform authenticator exists).
  const [pwEnrolled, setPwEnrolled] = useState(hasPasswordVault());
  const [pwOpen, setPwOpen] = useState(false);
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const enrollPw = async () => {
    if (!mnemonic) {
      setPwMsg("Unlock with your passphrase once in this tab, then set a password.");
      return;
    }
    if (pwNew.length < MIN_PASSWORD_LENGTH) {
      setPwMsg(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg("The passwords don't match.");
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await enrollPasswordVault(mnemonic, pwNew);
      setPwEnrolled(true);
      setPwOpen(false);
      setPwNew("");
      setPwConfirm("");
      setPwMsg("Done - unlock with this password next time on this device.");
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : "Couldn't set the unlock password.");
    } finally {
      setPwBusy(false);
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
              Post-quantum E2EE
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
          label={
            <span className="flex items-center gap-2">
              Unlock password
              {pwEnrolled && (
                <span className="inline-flex items-center gap-1 rounded-control bg-field px-2 py-0.5 text-[11px] font-medium text-positive">
                  <span className="size-1.5 rounded-full bg-positive" /> on
                </span>
              )}
            </span>
          }
          desc={
            pwMsg ??
            (pwEnrolled
              ? "Unlock with a password instead of the 12-word phrase. Your passphrase is encrypted with it - works on every device, no biometrics needed."
              : "Set a password to unlock on this device without the 12-word phrase. Encrypted at rest; nothing stored in plaintext. Works everywhere biometrics don't.")
          }
          control={
            pwEnrolled ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  removePasswordVault();
                  setPwEnrolled(false);
                  setPwMsg(null);
                }}
              >
                Remove
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPwOpen((v) => !v)}
                disabled={status !== "open"}
              >
                <Lock className="size-4" /> {pwOpen ? "Cancel" : "Set password"}
              </Button>
            )
          }
        >
          {pwOpen && !pwEnrolled && (
            <div className="mt-3 space-y-2.5">
              <PasswordInput
                placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}
                autoComplete="new-password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
              />
              <PasswordInput
                placeholder="Confirm password"
                autoComplete="new-password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
              />
              <Button size="sm" onClick={() => void enrollPw()} disabled={pwBusy || !pwNew || !pwConfirm}>
                {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Save password
              </Button>
            </div>
          )}
        </SettingRow>
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
        <SettingRow
          label="Switch account"
          desc="Sign out and start a brand-new identity on this device. Use this if you've lost your recovery passphrase and just want a fresh account. Your device preferences (theme, audio) are kept."
          control={
            <Button variant="danger" size="sm" onClick={() => setShowSwitch(true)}>
              <UserPlus className="size-4" /> New account
            </Button>
          }
        />
      </SettingGroup>
      {showSwitch && (
        <ConfirmDialog
          title="Start a new account?"
          body={
            <>
              This removes your current identity and its data from <b>this device</b> and takes you to setup for a new
              one.{" "}
              <b>If you haven't saved your recovery passphrase, you won't be able to sign back into this account</b> — it
              cannot be recovered.
            </>
          }
          confirmLabel="Remove & start new"
          onConfirm={() => {
            void startFresh(); // wipes local identity + hard-reloads to /welcome
          }}
          onClose={() => setShowSwitch(false)}
        />
      )}
    </SettingsPage>
  );
}
