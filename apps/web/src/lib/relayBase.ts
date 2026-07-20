// Base URL for the relay service (group channels, LiveKit tokens, Umbry AI).
//
// The value is resolved at RUNTIME from `endpoints.ts` (runtime override →
// build-time VITE_RELAY_URL → same-origin), so a self-hoster can point the app
// at their own relay from Settings → Self-hosting without a rebuild. An empty
// base keeps requests relative — they hit the Vite dev proxy in dev, or the same
// host on a same-origin deploy.
import { getRelayBase } from "./endpoints";

export function relayUrl(path: string): string {
  return `${getRelayBase()}${path}`;
}

export function relayWsUrl(path: string): string {
  const base = getRelayBase();
  if (base) {
    return `${base.replace(/^http/, "ws")}${path}`;
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}${path}`;
}
