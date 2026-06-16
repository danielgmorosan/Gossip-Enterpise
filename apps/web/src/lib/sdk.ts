/**
 * Gossip SDK wiring (Phase 2, in progress).
 *
 * Identity = BIP39 mnemonic (maps onto our passphrase onboarding). The SDK owns its own
 * SQLite (wa-sqlite + drizzle) store for DMs/contacts/profile; channels/workspace data stay
 * in our separate app DB.
 */
import { gossipSdk, SdkStatus } from "@massalabs/gossip-sdk";

const PROTOCOL_BASE_URL =
  import.meta.env.VITE_GOSSIP_API_URL ?? "https://api.usegossip.com";

let initPromise: Promise<unknown> | null = null;

/** Initialize the SDK once at app startup (idempotent). */
export function initSdk() {
  if (!initPromise) {
    initPromise = gossipSdk.init({ protocolBaseUrl: PROTOCOL_BASE_URL });
  }
  return initPromise;
}

/** Open a session from the user's recovery mnemonic. */
export async function unlockWithMnemonic(mnemonic: string) {
  await initSdk();
  await gossipSdk.openSession({ mnemonic });
  return gossipSdk.userId;
}

export function sdkStatus(): SdkStatus {
  if (gossipSdk.isSessionOpen) return SdkStatus.SESSION_OPEN;
  if (gossipSdk.isInitialized) return SdkStatus.INITIALIZED;
  return SdkStatus.UNINITIALIZED;
}

export { gossipSdk };
