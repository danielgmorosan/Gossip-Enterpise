import { create } from "zustand";
import { generateMnemonic, openSession, gossipSdk, initSdk } from "@/lib/sdk";

type Status = "locked" | "opening" | "open" | "error";

interface SessionState {
  status: Status;
  userId: string | null;
  /** Held in memory only (not persisted) for the lifetime of the app load. */
  mnemonic: string | null;
  /** Friendly name shown to others in group channels (persisted locally). */
  displayName: string;
  error: string | null;

  setDisplayName: (name: string) => void;
  /** Generate a brand-new BIP39 identity (does not open a session yet). */
  createIdentity: () => string;
  /** Open a real E2E session from a mnemonic / recovery passphrase. */
  unlock: (mnemonic: string) => Promise<boolean>;
  /** Warm up the SDK + WASM without opening a session. */
  warmup: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: gossipSdk.isSessionOpen ? "open" : "locked",
  userId: gossipSdk.isSessionOpen ? gossipSdk.userId : null,
  mnemonic: null,
  displayName: localStorage.getItem("gossip-display-name") ?? "",
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

  unlock: async (mnemonic: string) => {
    set({ status: "opening", error: null });
    try {
      const userId = await openSession(mnemonic);
      set({ status: "open", userId, mnemonic });
      return true;
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : "Failed to open session" });
      return false;
    }
  },

  signOut: async () => {
    try {
      if (gossipSdk.isSessionOpen) await gossipSdk.closeSession();
    } finally {
      set({ status: "locked", userId: null, mnemonic: null });
    }
  },
}));
