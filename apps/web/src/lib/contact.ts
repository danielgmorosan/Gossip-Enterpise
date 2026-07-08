/**
 * Contact-sharing links: /contact/:handle?name=<display name>
 *
 * Shares ONLY the public identity handle (gossip1…) and an optional display
 * name — never anything secret. Mirrors the invite-link handoff pattern in
 * lib/invite.ts: the landing page stashes the contact in sessionStorage so it
 * survives the identity unlock/create detour, and AppShell consumes it once
 * the user is inside a workspace.
 */
const KEY = "gossip-pending-contact";

export interface PendingContact {
  handle: string;
  name?: string;
}

export function contactLink(handle: string, name?: string): string {
  const params = new URLSearchParams();
  if (name?.trim()) params.set("name", name.trim());
  const q = params.toString();
  return `${location.origin}/contact/${encodeURIComponent(handle)}${q ? `?${q}` : ""}`;
}

export function isGossipHandle(handle: string): boolean {
  return /^gossip1[a-z0-9]{8,}$/i.test(handle);
}

export function setPendingContact(contact: PendingContact) {
  sessionStorage.setItem(KEY, JSON.stringify(contact));
}

/** Read-and-clear (single use). */
export function takePendingContact(): PendingContact | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    const parsed = JSON.parse(raw) as PendingContact;
    return isGossipHandle(parsed.handle) ? parsed : null;
  } catch {
    return null;
  }
}
