import { create } from "zustand";

/**
 * In-app notification layer (T2-09).
 *
 * Fed by the existing event streams only: the relay socket (channel messages,
 * workspace joins, private-channel invites, call starts) and the gossip-sdk
 * (DM messages / new conversations). Everything stays on this device — the
 * store never sends anything anywhere, and DM notifications carry NO message
 * content (just "new encrypted message from X"), so nothing can leak even
 * into OS notification logs.
 *
 * Preferences (types, mutes, OS, sound) persist to localStorage; the inbox
 * itself is session-scoped.
 */
export type NotifType = "message" | "mention" | "membership" | "dm" | "call";

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
  types: { message: true, mention: true, membership: true, dm: true, call: true },
  mutedChannels: [],
  mutedDms: [],
  os: false,
  sound: false,
};
function loadPrefs(): NotifPrefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") };
  } catch {
    return defaultPrefs;
  }
}

const INBOX_CAP = 100;

/** Short beep via WebAudio — no asset, no network. */
function beep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio blocked — fine */
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
      // Suppress for the conversation currently on screen — it's already read.
      const path = window.location.pathname;
      if (n.channelId && path.includes(`/c/${n.channelId}`)) return;
      if (n.peerId && path.includes(`/dm/${encodeURIComponent(n.peerId)}`)) return;

      const item: AppNotification = { ...n, id: crypto.randomUUID(), ts: n.ts ?? Date.now(), read: false };
      set((st) => ({
        items: [item, ...st.items].slice(0, INBOX_CAP),
        toast: item,
        unreadByChannel: n.channelId
          ? { ...st.unreadByChannel, [n.channelId]: (st.unreadByChannel[n.channelId] ?? 0) + 1 }
          : st.unreadByChannel,
        unreadByDm: n.peerId ? { ...st.unreadByDm, [n.peerId]: (st.unreadByDm[n.peerId] ?? 0) + 1 } : st.unreadByDm,
      }));

      if (prefs.sound) beep();
      // OS notification only when the tab isn't visible (in-app toast covers the rest).
      if (prefs.os && document.hidden && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(item.title, { body: item.body, tag: item.id, silent: true });
        } catch {
          /* blocked — in-app toast still shows */
        }
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
