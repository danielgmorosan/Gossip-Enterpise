import { Phone, PhoneOff, ShieldCheck } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useIncomingCall } from "@/stores/useIncomingCall";
import { router } from "@/app/router";

/**
 * Full-screen incoming DM call (T3). Mounted outside the router (main.tsx) so
 * it rings on every page. Accept navigates to the call page with ?answer=1 -
 * the flag tells CallPage NOT to send its own invite marker back.
 */
export function IncomingCallOverlay() {
  const call = useIncomingCall((s) => s.call);
  const { accept, decline } = useIncomingCall.getState();

  if (!call) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 font-stack backdrop-blur-sm">
      <div className="st-pop-in flex w-[320px] max-w-[calc(100vw-32px)] flex-col items-center rounded-card border border-line bg-paper p-6 text-center shadow-[var(--st-shadow-card)]">
        <div className="relative">
          <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-positive/25" />
          <UserAvatar name={call.name} id={call.peerId} className="!size-20 !text-[26px] relative !rounded-full" />
        </div>
        <div className="mt-4 text-[17px] font-bold tracking-tight text-ink">{call.name}</div>
        <div className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-ink-mute">
          <ShieldCheck className="size-3.5 text-positive" /> is calling you · encrypted DM call
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={decline}
            aria-label="Decline call"
            className="flex items-center gap-2 rounded-card bg-negative px-5 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <PhoneOff className="size-4" /> Decline
          </button>
          <button
            onClick={() => {
              const peerId = call.peerId;
              accept();
              void router.navigate(`/home/call/dm/${encodeURIComponent(peerId)}?answer=1`);
            }}
            aria-label="Accept call"
            className="flex items-center gap-2 rounded-card bg-positive px-5 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Phone className="size-4" /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
