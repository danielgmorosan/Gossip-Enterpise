import { useEffect } from "react";
import { gossipSdk, SdkEventType, MessageDirection, SELF_CONTACT_ID, type Message } from "@/lib/sdk";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { useNotifications } from "@/stores/useNotifications";
import { useIncomingCall } from "@/stores/useIncomingCall";
import { useCall } from "@/stores/useCall";
import { parseCallSignal, RING_WINDOW_MS } from "@/lib/callSignals";
import { truncateHandle } from "@/lib/utils";

/**
 * DM → notification wiring (T2-09) + DM call signaling (T3). Mounted by both
 * shells.
 *
 * Privacy: DM notifications NEVER carry message content - only "who". The
 * content stays inside the SDK's encrypted store; nothing is sent anywhere
 * (the notification store is local state).
 */
export function useDmNotifications() {
  const sessionOpen = useSession((s) => s.status === "open");

  useEffect(() => {
    if (!sessionOpen) return;

    const seenContacts = new Set(useContacts.getState().contacts.map((c) => c.userId));

    const onReceived = (raw: unknown) => {
      const m = raw as Omit<Message, "id"> & { id?: number };
      if (!m || m.direction !== MessageDirection.INCOMING) return;
      const peerId = m.contactUserId;
      if (!peerId || peerId === SELF_CONTACT_ID) return;
      const name =
        useContacts.getState().contacts.find((c) => c.userId === peerId)?.name ?? truncateHandle(peerId, 10, 4);

      // T3: call markers drive the ring overlay, never the generic DM notify.
      const signal = parseCallSignal(m.content);
      if (signal) {
        const incoming = useIncomingCall.getState();
        const fresh = Date.now() - new Date(m.timestamp).getTime() < RING_WINDOW_MS;
        if (signal === "invite" && fresh) {
          // Already on a call with them (or anyone)? Don't ring over it.
          if (useCall.getState().status === "idle") incoming.ring({ peerId, name });
        } else if (signal === "cancel" && incoming.call?.peerId === peerId) {
          incoming.dismiss();
          useNotifications.getState().notify({
            type: "call",
            title: `Missed call · ${name}`,
            body: "Tap to call back",
            link: `/home/call/dm/${encodeURIComponent(peerId)}`,
            peerId,
          });
        } else if (signal === "decline") {
          // We're the caller: they said no - end the outgoing call.
          const call = useCall.getState();
          if (call.status !== "idle" && call.target?.kind === "dm" && call.target.peerId === peerId) {
            void call.leave();
            useNotifications.getState().notify({
              type: "call",
              title: name,
              body: "Declined the call",
              link: `/home/dm/${encodeURIComponent(peerId)}`,
              peerId,
            });
          }
        }
        return;
      }

      const isNew = !seenContacts.has(peerId);
      seenContacts.add(peerId);
      useNotifications.getState().notify({
        type: "dm",
        title: isNew ? `New conversation · ${name}` : name,
        body: "New encrypted message", // deliberately content-free
        link: `/home/dm/${encodeURIComponent(peerId)}`,
        peerId,
      });
    };

    gossipSdk.on(SdkEventType.MESSAGE_RECEIVED, onReceived);
    return () => {
      gossipSdk.off(SdkEventType.MESSAGE_RECEIVED, onReceived);
    };
  }, [sessionOpen]);
}
