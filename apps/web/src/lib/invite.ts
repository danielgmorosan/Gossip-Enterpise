// Pending-invite handoff: /join/:code stashes the code here so it survives the
// identity create/unlock detour, then WorkspaceJoin prefills (and clears) it.
const KEY = "gossip-pending-invite";

export function setPendingInvite(code: string) {
  sessionStorage.setItem(KEY, code.trim().toUpperCase());
}

export function peekPendingInvite(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearPendingInvite() {
  sessionStorage.removeItem(KEY);
}

/** Shareable invite URL for a workspace code. */
export function inviteLink(code: string): string {
  return `${location.origin}/join/${code.trim().toUpperCase()}`;
}
