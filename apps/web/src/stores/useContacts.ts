import { useEffect } from "react";
import { create } from "zustand";
import { gossipSdk, SdkEventType, type Contact } from "@/lib/sdk";
import { useSession } from "./useSession";

interface ContactsState {
  contacts: Contact[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Add a contact by their gossip userId; the SDK fetches their public key from the relay. */
  add: (userId: string, name: string) => Promise<{ ok: boolean; error?: string }>;
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
      set({ contacts: await gossipSdk.contacts.list() });
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
      // Fetches their key, adds the contact, AND creates+initiates the discussion.
      const res = await gossipSdk.discussions.startByUserId(id, name.trim() || id.slice(0, 12), {
        message: "👋",
      });
      if (!res.success) return { ok: false, error: res.error?.message ?? "Couldn't start the chat." };
      await get().refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't start the chat (is their key published?)" };
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
    return useContacts.getState().subscribe();
  }, [sessionStatus, refresh]);
}
