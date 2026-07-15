import { create } from "zustand";
import { startRing, stopRing } from "@/lib/sounds";
import { sendCallSignal, RING_WINDOW_MS } from "@/lib/callSignals";
import { useNotifications, showOsNotification } from "@/stores/useNotifications";

/**
 * Incoming DM call state (T3). Set when a fresh `[[call:invite]]` marker
 * arrives; drives the full-screen IncomingCallOverlay (mounted in main.tsx)
 * and the looping ring. Cleared by accept, decline, the caller's cancel, or
 * the ring window running out (→ missed-call notification).
 */
interface IncomingCall {
  peerId: string;
  name: string;
}

interface IncomingCallState {
  call: IncomingCall | null;
  ring: (call: IncomingCall) => void;
  /** Stop ringing without responding (caller cancelled / call answered elsewhere). */
  dismiss: () => void;
  decline: () => void;
  /** Stops the ring; the overlay handles navigation to the call page. */
  accept: () => void;
}

let timeout: ReturnType<typeof setTimeout> | null = null;

export const useIncomingCall = create<IncomingCallState>((set, get) => {
  const clear = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
    stopRing();
    set({ call: null });
  };

  return {
    call: null,

    ring: (call) => {
      if (get().call) return; // already ringing - one call at a time
      set({ call });
      startRing();
      void showOsNotification(`${call.name} is calling you`, "Encrypted DM call", `/home/dm/${encodeURIComponent(call.peerId)}`);
      timeout = setTimeout(() => {
        const cur = get().call;
        if (!cur) return;
        clear();
        useNotifications.getState().notify({
          type: "call",
          title: `Missed call · ${cur.name}`,
          body: "Tap to call back",
          link: `/home/call/dm/${encodeURIComponent(cur.peerId)}`,
          peerId: cur.peerId,
        });
      }, RING_WINDOW_MS);
    },

    dismiss: clear,

    decline: () => {
      const cur = get().call;
      clear();
      if (cur) void sendCallSignal(cur.peerId, "decline");
    },

    accept: clear,
  };
});
