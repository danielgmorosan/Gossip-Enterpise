import { useEffect } from "react";
import { gossipSdk, SdkEventType, MessageDirection, SELF_CONTACT_ID, type Message } from "@/lib/sdk";
import { useSession } from "@/stores/useSession";
import { useContacts } from "@/stores/useContacts";
import { useNotifications } from "@/stores/useNotifications";
import { truncateHandle } from "@/lib/utils";

/**
 * DM → notification wiring (T2-09). Mounted by both shells.
 *
 * Privacy: DM notifications NEVER carry message content — only "who". The
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
