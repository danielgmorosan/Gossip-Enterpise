/**
 * Gossip SDK wiring (Phase 2).
 *
 * Identity = BIP39 mnemonic (the recovery passphrase shown at signup). The SDK owns its own
 * wa-sqlite + drizzle store for DMs/contacts/profile. Channels/workspace data stay in the app.
 *
 * NOTE: storage defaults to in-memory, so a session lives for the app's lifetime. Persistent
 * storage (OPFS) + onPersist with a passphrase-derived key is the next step.
 */
import {
  gossipSdk,
  generateMnemonic,
  validateMnemonic,
  SdkEventType,
  SELF_CONTACT_ID,
  type Message,
} from "@massalabs/gossip-sdk";

const PROTOCOL_BASE_URL =
  import.meta.env.VITE_GOSSIP_API_URL ?? "https://api.usegossip.com";

let initPromise: Promise<unknown> | null = null;

/** Initialize the SDK + load WASM once (idempotent). */
export function initSdk() {
  if (!initPromise) {
    initPromise = gossipSdk.init({ protocolBaseUrl: PROTOCOL_BASE_URL });
  }
  return initPromise;
}

/** Open a session from a BIP39 mnemonic (the recovery passphrase). */
export async function openSession(mnemonic: string) {
  await initSdk();
  if (!gossipSdk.isSessionOpen) {
    await gossipSdk.openSession({ mnemonic: mnemonic.trim() });
  }
  return gossipSdk.userId;
}

export {
  gossipSdk,
  generateMnemonic,
  validateMnemonic,
  SdkEventType,
  SELF_CONTACT_ID,
};
export type { Message };
