/**
 * Biometric vault (T3): unlock with Windows Hello / Touch ID / device PIN
 * instead of typing the recovery passphrase.
 *
 * How: a platform passkey is created with the WebAuthn PRF extension. PRF
 * gives us a secret that only exists after the OS verifies the user
 * (fingerprint/face/PIN) — we use it as an AES-GCM key to encrypt the
 * passphrase, and store only the ciphertext locally. Strictly stronger than
 * the plaintext "keep me unlocked" option: without the biometric gesture the
 * stored blob is just noise, and the PRF secret never leaves the
 * authenticator hardware.
 */

const VAULT_KEY = "gossip-bio-vault";

interface VaultBlob {
  credentialId: string; // base64url
  salt: string; // base64url — PRF eval input
  iv: string; // base64url — AES-GCM nonce
  ciphertext: string; // base64url — encrypted passphrase
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

function loadVault(): VaultBlob | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    return raw ? (JSON.parse(raw) as VaultBlob) : null;
  } catch {
    return null;
  }
}

/** A vault exists on this device (show the biometric unlock button). */
export function hasBiometricVault(): boolean {
  return !!loadVault();
}

/** WebAuthn platform authenticator available (Hello/Touch ID/PIN set up)? */
export async function biometricsAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** PRF secret → AES-GCM CryptoKey. */
async function prfToKey(prf: ArrayBuffer): Promise<CryptoKey> {
  const bits = await crypto.subtle.digest("SHA-256", prf);
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Run a WebAuthn assertion and return the PRF output for `salt`. */
async function assertPrf(credentialId: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId as BufferSource, type: "public-key", transports: ["internal"] }],
      userVerification: "required",
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("Biometric prompt was dismissed.");
  const prf = (assertion.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } }).prf
    ?.results?.first;
  if (!prf) throw new Error("This browser/authenticator doesn't support the PRF extension.");
  return prf;
}

/**
 * Enroll: create a passkey, verify PRF works, encrypt the passphrase with the
 * PRF-derived key. Two OS prompts (create + confirm), then it's set.
 */
export async function enrollBiometricVault(mnemonic: string, displayName: string): Promise<void> {
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Gossip", id: window.location.hostname },
      user: { id: userId as BufferSource, name: displayName || "Gossip user", displayName: displayName || "Gossip user" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        userVerification: "required",
      },
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error("Passkey creation was dismissed.");
  const prfSupported = (created.getClientExtensionResults() as { prf?: { enabled?: boolean } }).prf?.enabled;
  if (!prfSupported) {
    throw new Error("This device's authenticator doesn't support PRF — biometric unlock isn't available here.");
  }

  const credentialId = new Uint8Array(created.rawId);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  // Second prompt: evaluate PRF (most authenticators only do this on get()).
  const prf = await assertPrf(credentialId, salt);
  const key = await prfToKey(prf);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );

  const blob: VaultBlob = {
    credentialId: b64u.encode(credentialId),
    salt: b64u.encode(salt),
    iv: b64u.encode(iv),
    ciphertext: b64u.encode(ciphertext),
  };
  localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
}

/** One biometric prompt → the decrypted passphrase. */
export async function unlockBiometricVault(): Promise<string> {
  const blob = loadVault();
  if (!blob) throw new Error("No biometric vault on this device.");
  const prf = await assertPrf(b64u.decode(blob.credentialId), b64u.decode(blob.salt));
  const key = await prfToKey(prf);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64u.decode(blob.iv) as BufferSource },
    key,
    b64u.decode(blob.ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export function removeBiometricVault(): void {
  localStorage.removeItem(VAULT_KEY);
}
