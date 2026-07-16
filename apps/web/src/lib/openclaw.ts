import { OpenClawClient } from "@gossip/openclaw-bridge";
import { relayUrl } from "./relayBase";
import { getRelaySessionToken } from "@/stores/useRelay";

/**
 * The one OpenClaw client instance. All AI access from the app goes through
 * `packages/openclaw-bridge` (monorepo boundary) - no keys in the bundle;
 * the gateway holds credentials and enforces route/scope rules.
 */
export const openclaw = new OpenClawClient({
  baseUrl: relayUrl("/openclaw"),
  // D2: attach the relay session token so AI jobs carry a proven identity.
  getToken: () => getRelaySessionToken(),
});
