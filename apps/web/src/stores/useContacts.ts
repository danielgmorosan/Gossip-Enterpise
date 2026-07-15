import { useEffect } from "react";
import { create } from "zustand";
import { gossipSdk, SdkEventType, type Contact } from "@/lib/sdk";
import { useSession } from "./useSession";
import { truncateHandle } from "@/lib/utils";

/** The SDK auto-names incoming discussion requests "New Request N". */
const PLACEHOLDER_NAME = /^new request\s*\d*$/i;

/**
 * Incoming requests arrive with the SDK's placeholder name (T3). Upgrade
 * them: rename to the sender's workspace display name when we know it
 * (persisted via the SDK), and never *show* a placeholder — fall back to the
 * truncated handle.
 */
async function upgradePlaceholderNames(list: Contact[]): Promise<boolean> {
  const { useRelay } = await import("./useRelay"); // lazy: avoids an import cycle
  const members = useRelay.getState().workspace?.members ?? [];
  let renamed = false;
  for (const c of list) {
    if (!PLACEHOLDER_NAME.test((c.name ?? "").trim())) continue;
    const member = members.find((m) => m.userId === c.userId);
    if (!member?.name) continue;
    try {
      await gossipSdk.contacts.updateName(c.userId, member.name);
      renamed = true;
    } catch (e) {
      console.error("contact rename failed", e);
    }
  }
  return renamed;
}

/** Placeholder names never reach the UI — show the handle instead. */
function displayable(list: Contact[]): Contact[] {
  return list.map((c) =>
    PLACEHOLDER_NAME.test((c.name ?? "").trim()) ? { ...c, name: truncateHandle(c.userId, 10, 4) } : c,
  );
}

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Add a contact by their gossip userId; the SDK fetches their public key from the relay. */
  add: (userId: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  /** Set your local nickname for a contact (T3) — what all your DM UI shows. */
  rename: (userId: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  subscribe: () => () => void;
}

export const useContacts = create<ContactsState>((set, get) => ({
  contacts: [],
  loading: false,

  refresh: async () => {
    if (!gossipSdk.isSessionOpen) {
      set({ contacts: [] });
      return;
    }
    set({ loading: true });
    try {
      let list = await gossipSdk.contacts.list();
      // Rename "New Request N" contacts to their workspace display name.
      if (await upgradePlaceholderNames(list)) list = await gossipSdk.contacts.list();
      set({ contacts: displayable(list) });
    } catch (e) {
      console.error("contacts.list failed", e);
    } finally {
      set({ loading: false });
    }
  },

  add: async (userId, name) => {
    const id = userId.trim();
    if (!id.startsWith("gossip1")) return { ok: false, error: "Enter a valid gossip user ID (gossip1…)." };
    if (id === gossipSdk.userId) return { ok: false, error: "That's your own ID." };
    try {
      // Fetches their key, adds the contact, AND creates+initiates the
      // discussion. `username` rides inside the E2E announcement so the other
      // side names the contact after US — without it their SDK falls back to
      // "New Request N" (the bug everyone saw).
      const res = await gossipSdk.discussions.startByUserId(id, name.trim() || id.slice(0, 12), {
        username: useSession.getState().displayName || undefined,
        message: "👋",
      });
      if (!res.success) return { ok: false, error: res.error?.message ?? "Couldn't start the chat." };
      await get().refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't start the chat (is their key published?)" };
    }
  },

  rename: async (userId, name) => {
    const next = name.trim();
    if (!next) return { ok: false, error: "Nickname can't be empty." };
    try {
      await gossipSdk.contacts.updateName(userId, next);
      await get().refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't rename the contact." };
    }
  },

  subscribe: () => {
    const onChange = () => get().refresh();
    gossipSdk.on(SdkEventType.SESSION_CREATED, onChange);
    gossipSdk.on(SdkEventType.SESSION_REQUESTED, onChange);
    gossipSdk.on(SdkEventType.CONTACT_DELETED, onChange);
    gossipSdk.on(SdkEventType.MESSAGE_RECEIVED, onChange);
    return () => {
      gossipSdk.off(SdkEventType.SESSION_CREATED, onChange);
      gossipSdk.off(SdkEventType.SESSION_REQUESTED, onChange);
      gossipSdk.off(SdkEventType.CONTACT_DELETED, onChange);
      gossipSdk.off(SdkEventType.MESSAGE_RECEIVED, onChange);
    };
  },
}));

/** Keep the contact list fresh while the session is open (initial refresh + SDK events). */
export function useContactsLive() {
  const sessionStatus = useSession((s) => s.status);
  const refresh = useContacts((s) => s.refresh);
  useEffect(() => {
    if (sessionStatus !== "open") return;
    refresh();
    // Workspace membership arriving later can resolve placeholder contact
    // names — re-run the refresh (and its rename pass) when members change.
    let unsubRelay: (() => void) | undefined;
    void import("./useRelay").then(({ useRelay }) => {
      let lastKey = "";
      unsubRelay = useRelay.subscribe((s) => {
        const key = `${s.workspace?.id ?? ""}:${s.workspace?.members.length ?? 0}`;
        if (key === lastKey) return;
        lastKey = key;
        if (s.workspace) void refresh();
      });
    });
    const unsubSdk = useContacts.getState().subscribe();
    return () => {
      unsubSdk();
      unsubRelay?.();
    };
  }, [sessionStatus, refresh]);
}
