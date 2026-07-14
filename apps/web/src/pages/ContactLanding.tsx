import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MessageSquareLock, UserX } from "lucide-react";
import { Button } from "@gossip/ui/stack";
import { UserAvatar } from "@/components/UserAvatar";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { setPendingContact, isGossipHandle } from "@/lib/contact";
import { truncateHandle } from "@/lib/utils";

/**
 * Contact-link landing: /contact/:handle?name=…
 * Open session → "start DM" confirmation, then the home-space DM route
 * (/home/dm/:handle) — no workspace needed. Locked session → stash the
 * contact (single-use, sessionStorage) and route through unlock/create; the
 * shells pick it up afterwards. Only the PUBLIC handle is ever in the URL.
 */
export function ContactLanding() {
  const { handle = "" } = useParams();
  const [search] = useSearchParams();
  const name = search.get("name") ?? undefined;
  const nav = useNavigate();
  const status = useSession((s) => s.status);
  const myId = useSession((s) => s.userId);
  const [busy, setBusy] = useState(false);

  const valid = isGossipHandle(handle);
  const isSelf = status === "open" && myId === handle;

  useEffect(() => {
    if (!valid || isSelf) return;
    // Locked → stash + detour through unlock/create (mirrors /join/:code).
    if (status !== "open") {
      setPendingContact({ handle, name });
      const hasIdentity = !!localStorage.getItem("gossip-display-name");
      nav(hasIdentity ? "/identity/unlock" : "/identity/create", { replace: true });
    }
  }, [valid, isSelf, status, handle, name, nav]);

  const startDm = async () => {
    if (busy) return;
    setBusy(true);
    const known = useContacts.getState().contacts.some((c) => c.userId === handle);
    if (!known) void useContacts.getState().add(handle, name ?? handle.slice(0, 12));
    nav(`/home/dm/${encodeURIComponent(handle)}`, { replace: true });
  };

  if (!valid) {
    return (
      <Shell>
        <span className="mx-auto grid size-12 place-items-center rounded-card bg-field text-ink"><UserX className="size-6" /></span>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-ink">Not a valid contact link</h1>
        <p className="mt-1 text-[14px] text-ink-mute">The handle in this link doesn't look like a Gossip identity.</p>
        <Button className="mt-4" onClick={() => nav("/", { replace: true })}>Go home</Button>
      </Shell>
    );
  }

  if (isSelf) {
    return (
      <Shell>
        <UserAvatar name={name || "You"} id={handle} className="mx-auto !size-14 !text-[18px]" />
        <h1 className="mt-3 text-xl font-bold tracking-tight text-ink">That's your own contact link</h1>
        <p className="mt-1 text-[14px] text-ink-mute">Share it with someone else so they can DM you.</p>
        <Button className="mt-4" onClick={() => nav("/", { replace: true })}>Back to the app</Button>
      </Shell>
    );
  }

  if (status !== "open") {
    return (
      <Shell>
        <p className="text-[14px] text-ink-mute">Taking you to unlock…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <UserAvatar name={name || handle} id={handle} className="mx-auto !size-14 !text-[18px]" />
      <h1 className="mt-3 text-xl font-bold tracking-tight text-ink">{name || truncateHandle(handle, 12, 6)}</h1>
      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">{truncateHandle(handle, 16, 8)}</p>
      <p className="mt-3 text-[14px] text-ink-mute">
        Start an end-to-end encrypted direct message? They'll be added to your contacts.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button onClick={() => void startDm()} disabled={busy}>
          <MessageSquareLock className="size-4" /> Start encrypted DM
        </Button>
        <Button variant="secondary" onClick={() => nav("/", { replace: true })}>Cancel</Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper p-6 font-stack">
      <div className="max-w-sm text-center">{children}</div>
    </div>
  );
}
