import { create } from "zustand";
import { generateMnemonic, openSession, gossipSdk, initSdk } from "@/lib/sdk";
import { ensureAuthKey, clearAuthKey } from "@/lib/relayAuth";
import { removeBiometricVault } from "@/lib/biometricVault";

type Status = "locked" | "opening" | "open" | "error";

/**
 * Opt-in device persistence (T3): the recovery passphrase stored locally so
 * the session auto-unlocks on load. Convenience over maximum paranoia - the
 * user chooses it via "Keep me unlocked on this device", the UI says exactly
 * what it does, and signing out (or Security → forget) removes it.
 */
const REMEMBER_KEY = "gossip-remembered-passphrase";

interface SessionState {
  status: Status;
  userId: string | null;
  /** Held in memory only (not persisted) for the lifetime of the app load. */
  mnemonic: string | null;
  /** Friendly name shown to others in group channels (persisted locally). */
  displayName: string;
  /** True when a passphrase is stored on this device for auto-unlock. */
  remembered: boolean;
  error: string | null;

  setDisplayName: (name: string) => void;
  /** Generate a brand-new BIP39 identity (does not open a session yet). */
  createIdentity: () => string;
  /**
   * Open a real E2EE session from a mnemonic / recovery passphrase.
   * remember=true additionally stores it for auto-unlock on this device;
   * remember=false clears any stored one; undefined leaves it untouched.
   */
  unlock: (mnemonic: string, remember?: boolean) => Promise<boolean>;
  /** Auto-unlock from the device-stored passphrase (no-op without one). */
  autoUnlock: () => Promise<void>;
  /** Stop auto-unlocking on this device (session stays open). */
  forgetDevice: () => void;
  /** Warm up the SDK + WASM without opening a session. */
  warmup: () => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Wipe this identity (and its account-scoped data) from THIS device and
   * reload into onboarding for a new one. For someone who's lost their recovery
   * passphrase and wants a fresh account. Device prefs (theme/audio) are kept.
   */
  startFresh: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  status: gossipSdk.isSessionOpen ? "open" : "locked",
  userId: gossipSdk.isSessionOpen ? gossipSdk.userId : null,
  mnemonic: null,
  displayName: localStorage.getItem("gossip-display-name") ?? "",
  remembered: !!localStorage.getItem(REMEMBER_KEY),
  error: null,

  setDisplayName: (name: string) => {
    localStorage.setItem("gossip-display-name", name);
    set({ displayName: name });
  },

  createIdentity: () => {
    const mnemonic = generateMnemonic(128); // 12 words, matches the onboarding UI
    set({ mnemonic });
    return mnemonic;
  },

  warmup: async () => {
    try {
      await initSdk();
    } catch (e) {
      console.error("SDK init failed", e);
    }
  },

  unlock: async (mnemonic: string, remember?: boolean) => {
    set({ status: "opening", error: null });
    try {
      const userId = await openSession(mnemonic);
      if (remember === true) {
        localStorage.setItem(REMEMBER_KEY, mnemonic);
      } else if (remember === false) {
        localStorage.removeItem(REMEMBER_KEY);
      }
      set({ status: "open", userId, mnemonic, remembered: !!localStorage.getItem(REMEMBER_KEY) });
      // D2: derive the relay-auth key from the mnemonic now so it's ready to
      // prove our identity on the next hello (best-effort; legacy path if not).
      void ensureAuthKey(mnemonic);
      // The relay may already hold an anonymous socket for this tab -
      // re-announce with the real identity and refresh the open workspace so
      // membership-gated things (private channels, posting) work immediately.
      try {
        const { useRelay } = await import("./useRelay");
        useRelay.getState().syncProfile();
        const wsId = /^\/w\/([^/]+)/.exec(window.location.pathname)?.[1];
        if (wsId) void useRelay.getState().openWorkspace(wsId);
      } catch {
        /* relay refresh is best-effort */
      }
      return true;
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "Failed to open session" });
      return false;
    }
  },

  autoUnlock: async () => {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (!stored || gossipSdk.isSessionOpen || get().status === "opening") return;
    const ok = await get().unlock(stored);
    if (!ok) {
      // Stored phrase no longer opens a session - don't retry-loop on it.
      localStorage.removeItem(REMEMBER_KEY);
      set({ status: "locked", remembered: false, error: null });
    }
  },

  forgetDevice: () => {
    localStorage.removeItem(REMEMBER_KEY);
    set({ remembered: false });
  },

  signOut: async () => {
    // Reset local session state FIRST so the lock always takes effect — even if
    // the SDK close is slow or throws. (Previously an unhandled closeSession
    // rejection ran before navigation, so "Lock session" silently did nothing.)
    localStorage.removeItem(REMEMBER_KEY);
    clearAuthKey(); // D2: forget the relay-auth key on sign-out
    set({ status: "locked", userId: null, mnemonic: null, remembered: false });
    try {
      if (gossipSdk.isSessionOpen) await gossipSdk.closeSession();
    } catch {
      /* best-effort — local session state is already cleared */
    }
  },

  startFresh: async () => {
    // Remove identity- and account-scoped local state; keep device prefs
    // (theme, audio, layout) so the new identity starts clean but familiar.
    const PRESERVE = new Set([
      "gossip-theme",
      "gossip-audio-settings",
      "gossip-advanced-audio",
      "gossip-call-volumes",
      "gossip-share-vh",
      "gossip-recent-gifs",
    ]);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("gossip-") && !PRESERVE.has(key)) localStorage.removeItem(key);
    }
    clearAuthKey();
    try {
      removeBiometricVault(); // clears the biometric vault (localStorage + IndexedDB)
    } catch {
      /* best-effort */
    }
    try {
      if (gossipSdk.isSessionOpen) await gossipSdk.closeSession();
    } catch {
      /* best-effort */
    }
    // Hard reload so no in-memory store keeps stale identity data.
    window.location.assign("/welcome");
  },
}));
