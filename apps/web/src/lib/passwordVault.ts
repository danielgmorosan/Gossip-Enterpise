/**
 * Password unlock vault — encrypt the recovery passphrase with a key derived
 * from a user-chosen unlock password, so returning users type a short password
 * instead of the 12-word phrase.
 *
 * This is the universal counterpart to the biometric vault (biometricVault.ts):
 * it needs no platform authenticator and no native code, so it works everywhere
 * — every browser and, crucially, the Electron desktop app on Windows/Linux
 * where no WebAuthn platform authenticator (Windows Hello) is exposed.
 *
 * Trust model (labelled honestly in the UI): the passphrase is AES-256-GCM
 * encrypted at rest under a PBKDF2-SHA256 key derived from the password. Nothing
 * is stored in plaintext, but a *weak* password is only as strong as the KDF
 * against an offline attacker who has the device — so we encourage a strong one.
 * The 12-word phrase remains the real identity secret and the only recovery.
 */

const VAULT_KEY = "gossip-pw-vault";
const PBKDF2_ITERATIONS = 310_000; // OWASP-ish for PBKDF2-HMAC-SHA256
export const MIN_PASSWORD_LENGTH = 8;

interface PwVaultBlob {
  v: 1;
  salt: string; // base64url — PBKDF2 salt
  iv: string; // base64url — AES-GCM nonce
  iterations: number; // stored so we can raise the cost later without breaking old vaults
  ciphertext: string; // base64url — encrypted mnemonic
}

const b64u = {
  encode: (buf: ArrayBuffer | Uint8Array): string => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode: (s: string): Uint8Array => {
    const norm = s.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(norm), (c) => c.charCodeAt(0));
  },
};

function loadVault(): PwVaultBlob | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? (JSON.parse(raw) as PwVaultBlob) : null;
  } catch {
    return null;
  }
}

/** A password vault exists on this device (offer password unlock). */
export function hasPasswordVault(): boolean {
  return !!loadVault();
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Set (or replace) the unlock password protecting the recovery passphrase. */
export async function enrollPasswordVault(mnemonic: string, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );
  const blob: PwVaultBlob = {
    v: 1,
    salt: b64u.encode(salt),
    iv: b64u.encode(iv),
    iterations: PBKDF2_ITERATIONS,
    ciphertext: b64u.encode(ct),
  };
  localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
}

/** One password → the decrypted recovery passphrase. Throws on a wrong password. */
export async function unlockPasswordVault(password: string): Promise<string> {
  const blob = loadVault();
  if (!blob) throw new Error("No unlock password is set on this device.");
  const key = await deriveKey(password, b64u.decode(blob.salt), blob.iterations ?? PBKDF2_ITERATIONS);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64u.decode(blob.iv) as BufferSource },
      key,
      b64u.decode(blob.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    // AES-GCM auth failure == wrong password (or tampered blob).
    throw new Error("Incorrect unlock password.");
  }
}

export function removePasswordVault(): void {
  localStorage.removeItem(VAULT_KEY);
}
