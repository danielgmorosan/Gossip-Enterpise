/**
 * Call-target helpers. A call target is either a channel (room name
 * `${workspaceId}:${channelId}`, unchanged) or a 1:1 DM.
 *
 * DM rooms are named by hashing the *sorted* pair of public handles, so both
 * participants derive the same room independently, and the room name is an
 * opaque digest - no DM content (and not even the raw handles) appears in
 * signaling or room names.
 */
export async function dmRoomName(a: string, b: string): Promise<string> {
  const pair = [a, b].sort().join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair));
  const hex = Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return `dm:${hex.slice(0, 32)}`;
}
