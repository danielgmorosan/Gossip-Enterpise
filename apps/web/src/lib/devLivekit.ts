import { Room } from "livekit-client";
import { relayAuthHeader } from "@/stores/useRelay";

// Dev-only handle to drive a LiveKit connection from automation/console.
if (import.meta.env.DEV) {
  (globalThis as unknown as { __livekit: unknown }).__livekit = {
    async connect(room: string, identity: string, name: string) {
      const res = await fetch("/livekit-token", {
        method: "POST",
        headers: { "content-type": "application/json", ...relayAuthHeader() },
        body: JSON.stringify({ room, identity, name }),
      });
      const { token, url } = await res.json();
      const r = new Room();
      await r.connect(url, token);
      try {
        await r.localParticipant.setMicrophoneEnabled(true);
        await r.localParticipant.setCameraEnabled(true);
      } catch {
        /* fake media may vary */
      }
      (globalThis as unknown as { __lkRoom: Room }).__lkRoom = r;
      return { state: r.state, local: r.localParticipant.identity, url };
    },
    remotes() {
      const r = (globalThis as unknown as { __lkRoom?: Room }).__lkRoom;
      return r ? [...r.remoteParticipants.values()].map((p) => p.identity) : [];
    },
  };
}
