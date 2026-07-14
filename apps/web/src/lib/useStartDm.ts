import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts } from "@/stores/useContacts";
import { useSession } from "@/stores/useSession";

/**
 * Start (or open) a 1:1 E2E DM with someone by their gossip userId — e.g. from a
 * channel message or the members list. DMs live in the personal home space
 * (/home), outside any workspace. Navigates immediately; if they aren't a
 * contact yet, kicks off the discussion in the background (RealDmView shows pending).
 */
export function useStartDm() {
  const nav = useNavigate();

  return useCallback(
    (userId?: string, name?: string) => {
      if (!userId) return;
      const myId = useSession.getState().userId;
      if (userId === myId) {
        nav("/home/dm/dm_self");
        return;
      }
      if (!userId.startsWith("gossip1")) return; // not a real identity (shouldn't happen)
      const known = useContacts.getState().contacts.some((c) => c.userId === userId);
      if (!known) void useContacts.getState().add(userId, name ?? userId.slice(0, 12));
      nav(`/home/dm/${encodeURIComponent(userId)}`);
    },
    [nav],
  );
}
