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
  MessageDirection,
  MessageType,
  type Message,
  type Contact,
} from "@massalabs/gossip-sdk";
import { getGossipApiUrl } from "./endpoints";

// In dev we route through Vite's proxy (/gossip-relay) to dodge the relay's CORS.
// In prod use the configured URL, resolved at init time from the runtime endpoint
// store (Settings → Self-hosting override → VITE_GOSSIP_API_URL → api.usegossip.com).
// The SDK bakes this into a single init(), so changing it takes effect on the next
// session (a reload) — acceptable since DMs are already sovereign and this URL is
// an advanced knob most self-hosters never touch.
function protocolBaseUrl(): string {
  return import.meta.env.DEV ? "/gossip-relay" : getGossipApiUrl();
}

let initPromise: Promise<unknown> | null = null;

/** Initialize the SDK + load WASM once (idempotent). Polling on so peers' messages arrive. */
export function initSdk() {
  if (!initPromise) {
    initPromise = gossipSdk.init({
      protocolBaseUrl: protocolBaseUrl(),
      config: { polling: { enabled: true } },
    });
  }
  return initPromise;
}

let autoAcceptWired = false;

/** Open a session from a BIP39 mnemonic (the recovery passphrase). */
export async function openSession(mnemonic: string) {
  await initSdk();
  if (!gossipSdk.isSessionOpen) {
    await gossipSdk.openSession({ mnemonic: mnemonic.trim() });
  }
  // Auto-accept incoming 1:1 discussion requests so peer DMs "just work".
  if (!autoAcceptWired) {
    autoAcceptWired = true;
    gossipSdk.on(SdkEventType.SESSION_REQUESTED, async (p: { discussion: unknown }) => {
      try {
        await gossipSdk.discussions.accept(p.discussion as never);
      } catch (e) {
        console.error("auto-accept discussion failed", e);
      }
    });
  }
  // The event only covers requests that arrive while we're online - requests
  // received while offline sit pending forever (replies stuck on
  // "waiting_session"). Sweep and accept them on every unlock (T3).
  void (async () => {
    try {
      const discussions = (await gossipSdk.discussions.list()) as { weAccepted?: boolean }[];
      for (const d of discussions) {
        if (d.weAccepted) continue;
        try {
          await gossipSdk.discussions.accept(d as never);
        } catch (e) {
          console.error("pending-discussion accept failed", e);
        }
      }
    } catch (e) {
      console.error("pending-discussion sweep failed", e);
    }
  })();
  return gossipSdk.userId;
}

export {
  gossipSdk,
  generateMnemonic,
  validateMnemonic,
  SdkEventType,
  SELF_CONTACT_ID,
  MessageDirection,
  MessageType,
};
export type { Message, Contact };

// Dev-only handle for testing real peer DMs from the console / automation.
if (import.meta.env.DEV) {
  (globalThis as unknown as { __sdk: unknown }).__sdk = {
    gossipSdk,
    generateMnemonic,
    initSdk,
    openSession,
  };
}
