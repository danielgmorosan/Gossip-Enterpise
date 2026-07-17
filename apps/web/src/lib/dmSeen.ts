/**
 * DM read receipts (T4). No server sees DM content, so - like call signals
 * and reactions - "I've read up to message N" is a tiny marker sent over the
 * E2EE channel itself. Clients keep only the peer's LATEST marker and render
 * "Seen" under your last outgoing message when it's covered. SDK message ids
 * are numeric and protocol-stable, so >= comparisons are safe.
 */

const PREFIX = "[[seen:";
const SUFFIX = "]]";

export function dmSeenBody(uptoId: number): string {
  return `${PREFIX}${uptoId}${SUFFIX}`;
}

/** The seen watermark, if `body` is exactly a seen marker; null otherwise. */
export function parseDmSeen(body: string | null | undefined): number | null {
  if (!body || !body.startsWith(PREFIX) || !body.endsWith(SUFFIX)) return null;
  const n = Number(body.slice(PREFIX.length, -SUFFIX.length));
  return Number.isFinite(n) && n > 0 ? n : null;
}
