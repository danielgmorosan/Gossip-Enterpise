// Base URL for the relay service (group channels, LiveKit tokens, Gossip AI).
//
// Local dev and the old same-origin Vercel multi-service setup both leave this unset, so
// requests stay relative and either hit the Vite dev proxy or the same host. Once web
// (Vercel) and relay (Fly.io) are split across origins, set VITE_RELAY_URL to the relay's
// deployed URL (e.g. https://gossip-relay.fly.dev) at build time.
const RELAY_BASE = (import.meta.env.VITE_RELAY_URL ?? "").replace(/\/$/, "");

export function relayUrl(path: string): string {
  return `${RELAY_BASE}${path}`;
}

export function relayWsUrl(path: string): string {
  if (RELAY_BASE) {
    return `${RELAY_BASE.replace(/^http/, "ws")}${path}`;
  }
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}${path}`;
}
