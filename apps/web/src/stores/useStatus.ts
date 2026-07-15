import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Your presence status (T3). "online" = others see you online; "invisible" =
 * others see you offline while you keep full access. Persisted locally and
 * announced to the relay via hello; the relay enforces what others see.
 */
export type PresenceStatus = "online" | "invisible";

interface StatusState {
  status: PresenceStatus;
  setStatus: (status: PresenceStatus) => void;
}

export const useStatus = create<StatusState>()(
  persist(
    (set) => ({
      status: "online",
      setStatus: (status) => {
        set({ status });
        // Re-announce so the relay flips our visibility immediately.
        void import("./useRelay").then(({ useRelay }) => useRelay.getState().syncProfile());
      },
    }),
    { name: "gossip-presence-status" },
  ),
);
