/**
 * Biometric vault (T3): unlock with Windows Hello / Touch ID / device PIN
 * instead of typing the recovery passphrase.
 *
 * Two protection modes, negotiated at enrollment:
 *
 * - "prf" (strongest): the passkey's PRF extension derives the AES key -
 *   the secret physically lives in the authenticator and only exists after
 *   a verified gesture. Chrome/Edge on modern Windows/macOS.
 * - "gate" (fallback): a NON-EXTRACTABLE AES key in IndexedDB decrypts the
 *   passphrase, but only after a successful user-verifying WebAuthn
 *   assertion. Needed because Firefox/older Windows can't do PRF (their
 *   WebAuthn errors out with "unknown transient reason"). No plaintext on
 *   disk and the key can't be exported, but the gate is app-enforced rather
 *   than chip-enforced - we label it honestly.
 */

const VAULT_KEY = "gossip-bio-vault";
const IDB_NAME = "gossip-bio";
const IDB_STORE = "keys";

export type VaultMode = "prf" | "gate";

interface VaultBlob {
  mode: VaultMode;
  credentialId: string; // base64url
  salt: string; // base64url - PRF eval input (prf mode)
  iv: string; // base64url - AES-GCM nonce
  ciphertext: string; // base64url - encrypted passphrase
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

// ── IndexedDB for the non-extractable gate key ──────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return out;
}
async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

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

/** Which protection mode the enrolled vault uses (null = none). */
export function biometricVaultMode(): VaultMode | null {
  return loadVault()?.mode ?? null;
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

function friendlyWebAuthnError(e: unknown): Error {
  const err = e instanceof Error ? e : new Error(String(e));
  if (err.name === "NotAllowedError") {
    return new Error("Biometric prompt was cancelled or timed out.");
  }
  if (/transient|unknown/i.test(err.message)) {
    return new Error(
      "The browser's authenticator failed (a Firefox + Windows Hello quirk). Try again - or use Chrome/Edge on this device for the stronger PRF mode.",
    );
  }
  return err;
}

async function prfToKey(prf: ArrayBuffer): Promise<CryptoKey> {
  const bits = await crypto.subtle.digest("SHA-256", prf);
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** User-verifying assertion; returns PRF output when `salt` given and supported. */
async function assertUv(credentialId: Uint8Array, salt?: Uint8Array): Promise<ArrayBuffer | null> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId as BufferSource, type: "public-key", transports: ["internal"] }],
      userVerification: "required",
      ...(salt
        ? { extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs }
        : {}),
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("Biometric prompt was dismissed.");
  if (!salt) return null;
  return (
    (assertion.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } }).prf?.results?.first ??
    null
  );
}

async function createPasskey(displayName: string, withPrf: boolean): Promise<PublicKeyCredential> {
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Gossip", id: window.location.hostname },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)) as BufferSource,
        name: displayName || "Gossip user",
        displayName: displayName || "Gossip user",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred", // "required" trips some Firefox/Hello combos
        userVerification: "required",
      },
      ...(withPrf ? { extensions: { prf: {} } as AuthenticationExtensionsClientInputs } : {}),
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error("Passkey creation was dismissed.");
  return created;
}

/**
 * Enroll. Attempts PRF first; falls back to the gate mode when the browser
 * or authenticator can't do PRF. Returns the mode that ended up active.
 */
export async function enrollBiometricVault(mnemonic: string, displayName: string): Promise<VaultMode> {
  let credential: PublicKeyCredential | null = null;
  let prfEnabled = false;
  try {
    credential = await createPasskey(displayName, true);
    prfEnabled = !!(credential.getClientExtensionResults() as { prf?: { enabled?: boolean } }).prf?.enabled;
  } catch (e) {
    if ((e as Error)?.name === "NotAllowedError") throw friendlyWebAuthnError(e);
    // PRF-flavored create failed (Firefox/Hello) - retry without the extension.
    credential = null;
  }
  try {
    credential ??= await createPasskey(displayName, false);
  } catch (e) {
    throw friendlyWebAuthnError(e);
  }

  const credentialId = new Uint8Array(credential.rawId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encode = (mode: VaultMode, salt: Uint8Array, ciphertext: ArrayBuffer) => {
    const blob: VaultBlob = {
      mode,
      credentialId: b64u.encode(credentialId),
      salt: b64u.encode(salt),
      iv: b64u.encode(iv),
      ciphertext: b64u.encode(ciphertext),
    };
    localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
  };

  if (prfEnabled) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const prf = await assertUv(credentialId, salt);
      if (prf) {
        const key = await prfToKey(prf);
        const ct = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: iv as BufferSource },
          key,
          new TextEncoder().encode(mnemonic),
        );
        encode("prf", salt, ct);
        return "prf";
      }
    } catch {
      /* PRF evaluation failed - fall through to gate mode */
    }
  }

  // Gate mode: non-extractable key in IndexedDB, used only after UV succeeds.
  const gateKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    gateKey,
    new TextEncoder().encode(mnemonic),
  );
  await idbPut(VAULT_KEY, gateKey);
  encode("gate", crypto.getRandomValues(new Uint8Array(32)), ct);
  return "gate";
}

/** One biometric prompt → the decrypted passphrase. */
export async function unlockBiometricVault(): Promise<string> {
  const blob = loadVault();
  if (!blob) throw new Error("No biometric vault on this device.");
  try {
    if (blob.mode === "prf") {
      const prf = await assertUv(b64u.decode(blob.credentialId), b64u.decode(blob.salt));
      if (!prf) throw new Error("This browser couldn't evaluate the passkey's PRF.");
      const key = await prfToKey(prf);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64u.decode(blob.iv) as BufferSource },
        key,
        b64u.decode(blob.ciphertext) as BufferSource,
      );
      return new TextDecoder().decode(plain);
    }
    // Gate mode: verify the user first, then use the local key.
    await assertUv(b64u.decode(blob.credentialId));
    const gateKey = await idbGet<CryptoKey>(VAULT_KEY);
    if (!gateKey) throw new Error("The vault key is missing - remove and re-enable biometric unlock.");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64u.decode(blob.iv) as BufferSource },
      gateKey,
      b64u.decode(blob.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch (e) {
    throw friendlyWebAuthnError(e);
  }
}

export function removeBiometricVault(): void {
  localStorage.removeItem(VAULT_KEY);
  void idbDelete(VAULT_KEY);
}
