import { gossipSdk } from "@/lib/sdk";

/**
 * DM call signaling (T3). DM call rooms are deterministic digests, so there is
 * no server that could announce a call - instead the caller sends a tiny
 * marker message over the E2E DM channel itself. The recipient's client
 * recognizes the marker, rings, and renders it as a call chip (never as raw
 * text). Works with plain sendText: no SDK changes, fully E2E, and a client
 * that doesn't understand the marker still shows *something* in the thread.
 */
export type CallSignal = "invite" | "cancel" | "decline";

const PREFIX = "[[call:";
const SUFFIX = "]]";

export function callSignalBody(s: CallSignal): string {
  return `${PREFIX}${s}${SUFFIX}`;
}

/** The signal, if `body` is exactly a call marker; null for normal messages. */
export function parseCallSignal(body: string | null | undefined): CallSignal | null {
  if (!body || !body.startsWith(PREFIX) || !body.endsWith(SUFFIX)) return null;
  const s = body.slice(PREFIX.length, -SUFFIX.length);
  return s === "invite" || s === "cancel" || s === "decline" ? s : null;
}

/** Human rendering for a call marker in a DM thread. */
export function callSignalLabel(s: CallSignal, mine: boolean, peerName: string): string {
  switch (s) {
    case "invite":
      return mine ? "You started a call" : `${peerName} started a call`;
    case "cancel":
      return mine ? "You ended the call" : `${peerName} ended the call`;
    case "decline":
      return mine ? "You declined the call" : `${peerName} declined the call`;
  }
}

/** Ring window: invites older than this (offline delivery) never ring. */
export const RING_WINDOW_MS = 45_000;

export async function sendCallSignal(peerId: string, s: CallSignal): Promise<void> {
  if (!gossipSdk.isSessionOpen) return;
  try {
    await gossipSdk.messages.sendText(peerId, callSignalBody(s));
  } catch (e) {
    console.error(`call signal ${s} failed`, e);
  }
}
