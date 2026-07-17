import { create } from "zustand";
import { playChime, playCallChime, playQuack } from "@/lib/sounds";

/**
 * In-app notification layer (T2-09).
 *
 * Fed by the existing event streams only: the relay socket (channel messages,
 * workspace joins, private-channel invites, call starts) and the gossip-sdk
 * (DM messages / new conversations). Everything stays on this device - the
 * store never sends anything anywhere, and DM notifications carry NO message
 * content (just "new encrypted message from X"), so nothing can leak even
 * into OS notification logs.
 *
 * Preferences (types, mutes, OS, sound) persist to localStorage; the inbox
 * itself is session-scoped.
 */
export type NotifType = "message" | "mention" | "membership" | "dm" | "call" | "poke";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  /** In-app route this notification deep-links to. */
  link: string;
  ts: number;
  read: boolean;
  channelId?: string;
  peerId?: string;
}

interface NotifPrefs {
  types: Record<NotifType, boolean>;
  mutedChannels: string[];
  mutedDms: string[];
  os: boolean;
  sound: boolean;
}

const PREFS_KEY = "gossip-notif-prefs";
const defaultPrefs: NotifPrefs = {
  types: { message: true, mention: true, membership: true, dm: true, call: true, poke: true },
  mutedChannels: [],
  mutedDms: [],
  os: false,
  sound: true,
};
function loadPrefs(): NotifPrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<NotifPrefs>;
    // Deep-merge `types` so prefs saved before a type existed keep its default.
    return { ...defaultPrefs, ...stored, types: { ...defaultPrefs.types, ...(stored.types ?? {}) } };
  } catch {
    return defaultPrefs;
  }
}

const INBOX_CAP = 100;

/**
 * OS-level notification. Android (and installed PWAs generally) reject the
 * `new Notification()` constructor - the service-worker registration's
 * showNotification is the only path that works there, so prefer it.
 */
export async function showOsNotification(title: string, body: string, link: string, tag?: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, data: { link } });
      return;
    }
  } catch {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, { body, tag, silent: true });
  } catch {
    /* blocked - in-app toast still shows */
  }
}

interface NotificationsState {
  items: AppNotification[];
  /** Latest notification for the transient toast (cleared after display). */
  toast: AppNotification | null;
  unreadByChannel: Record<string, number>;
  unreadByDm: Record<string, number>;
  prefs: NotifPrefs;

  /** Total inbox unread. */
  unreadCount: () => number;
  /**
   * Route an event into the inbox. Applies type + mute filters and skips the
   * conversation currently on screen. Fires toast/OS/sound side effects.
   */
  notify: (n: Omit<AppNotification, "id" | "read" | "ts"> & { ts?: number }) => void;
  dismissToast: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearChannelUnread: (channelId: string) => void;
  clearDmUnread: (peerId: string) => void;
  /** Seed channel badges from the relay's server-side unread counts (T4). */
  seedChannelUnread: (counts: Record<string, number>) => void;
  setTypeEnabled: (t: NotifType, on: boolean) => void;
  toggleMuteChannel: (channelId: string) => void;
  toggleMuteDm: (peerId: string) => void;
  /** Enabling requests browser permission; resolves to the resulting state. */
  setOsEnabled: (on: boolean) => Promise<boolean>;
  setSoundEnabled: (on: boolean) => void;
}

export const useNotifications = create<NotificationsState>((set, get) => {
  const savePrefs = (prefs: NotifPrefs) => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    set({ prefs });
  };

  return {
    items: [],
    toast: null,
    unreadByChannel: {},
    unreadByDm: {},
    prefs: loadPrefs(),

    unreadCount: () => get().items.filter((n) => !n.read).length,

    notify: (n) => {
      const { prefs } = get();
      if (!prefs.types[n.type]) return;
      if (n.channelId && prefs.mutedChannels.includes(n.channelId)) return;
      if (n.peerId && prefs.mutedDms.includes(n.peerId)) return;
      // Suppress for the conversation currently on screen - it's already read.
      // Pokes are exempt: their whole job is grabbing attention wherever you are.
      const path = window.location.pathname;
      if (n.type !== "poke") {
        if (n.channelId && path.includes(`/c/${n.channelId}`)) return;
        if (n.peerId && path.includes(`/dm/${encodeURIComponent(n.peerId)}`)) return;
      }

      const item: AppNotification = { ...n, id: crypto.randomUUID(), ts: n.ts ?? Date.now(), read: false };
      set((st) => ({
        items: [item, ...st.items].slice(0, INBOX_CAP),
        toast: item,
        unreadByChannel: n.channelId
          ? { ...st.unreadByChannel, [n.channelId]: (st.unreadByChannel[n.channelId] ?? 0) + 1 }
          : st.unreadByChannel,
        unreadByDm: n.peerId ? { ...st.unreadByDm, [n.peerId]: (st.unreadByDm[n.peerId] ?? 0) + 1 } : st.unreadByDm,
      }));

      if (prefs.sound) (n.type === "call" ? playCallChime : n.type === "poke" ? playQuack : playChime)();
      // OS notification only when the tab isn't visible (in-app toast covers the rest).
      if (prefs.os && document.hidden) {
        void showOsNotification(item.title, item.body, item.link, item.id);
      }
    },

    dismissToast: () => set({ toast: null }),

    markRead: (id) => set((st) => ({ items: st.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markAllRead: () => set((st) => ({ items: st.items.map((n) => ({ ...n, read: true })) })),

    clearChannelUnread: (channelId) =>
      set((st) => {
        if (!(channelId in st.unreadByChannel)) return st;
        const next = { ...st.unreadByChannel };
        delete next[channelId];
        return { unreadByChannel: next };
      }),
    clearDmUnread: (peerId) =>
      set((st) => {
        if (!(peerId in st.unreadByDm)) return st;
        const next = { ...st.unreadByDm };
        delete next[peerId];
        return { unreadByDm: next };
      }),

    seedChannelUnread: (counts) =>
      set((st) => {
        // Server truth replaces the session-local counts for these channels
        // (the channel currently on screen is immediately re-cleared by the
        // view's markRead effect).
        const next = { ...st.unreadByChannel };
        for (const [chId, n] of Object.entries(counts)) {
          if (n > 0) next[chId] = n;
          else delete next[chId];
        }
        return { unreadByChannel: next };
      }),

    setTypeEnabled: (t, on) => savePrefs({ ...get().prefs, types: { ...get().prefs.types, [t]: on } }),
    toggleMuteChannel: (channelId) => {
      const p = get().prefs;
      savePrefs({
        ...p,
        mutedChannels: p.mutedChannels.includes(channelId)
          ? p.mutedChannels.filter((x) => x !== channelId)
          : [...p.mutedChannels, channelId],
      });
    },
    toggleMuteDm: (peerId) => {
      const p = get().prefs;
      savePrefs({
        ...p,
        mutedDms: p.mutedDms.includes(peerId) ? p.mutedDms.filter((x) => x !== peerId) : [...p.mutedDms, peerId],
      });
    },

    setOsEnabled: async (on) => {
      if (!on) {
        savePrefs({ ...get().prefs, os: false });
        return false;
      }
      if (!("Notification" in window)) return false;
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      const granted = perm === "granted";
      savePrefs({ ...get().prefs, os: granted });
      return granted;
    },
    setSoundEnabled: (on) => savePrefs({ ...get().prefs, sound: on }),
  };
});

/** True when `body` contains a T2-05 mention token targeting `userId`. */
export function mentionsUser(body: string, userId: string | null): boolean {
  return !!userId && body.includes(`](${userId})`);
}
