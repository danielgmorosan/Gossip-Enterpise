import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { takePendingContact } from "@/lib/contact";

/**
 * Resolve a stashed contact link (/contact/:handle visited while locked):
 * once the session is open, add the contact if needed and open the DM in the
 * home space. Mounted by both shells so it fires wherever the user lands
 * after unlock — a workspace or /home (DMs don't need a workspace).
 */
export function usePendingContactRedirect() {
  const nav = useNavigate();
  const sessionOpen = useSession((s) => s.status === "open");

  useEffect(() => {
    if (!sessionOpen) return;
    const pending = takePendingContact();
    if (!pending || pending.handle === useSession.getState().userId) return;
    const known = useContacts.getState().contacts.some((c) => c.userId === pending.handle);
    if (!known) void useContacts.getState().add(pending.handle, pending.name ?? pending.handle.slice(0, 12));
    nav(`/home/dm/${encodeURIComponent(pending.handle)}`);
  }, [sessionOpen, nav]);
}
