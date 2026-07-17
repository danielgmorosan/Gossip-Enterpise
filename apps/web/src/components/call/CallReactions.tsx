import { useEffect, useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { Tooltip } from "@umbry/ui/stack";
import { playQuack } from "@/lib/sounds";
import { useAudioSettings } from "@/stores/useAudioSettings";
import { cn } from "@/lib/utils";

/**
 * In-call emoji reactions (T4), Discord-style: tap to spray emoji over the
 * stage for everyone. Rides LiveKit's lossy data channel - ephemeral by
 * design, no server or store involved. 🦆 also quacks (recipients can turn
 * reaction sounds off in Settings → Calls).
 */

const QUICK = ["👍", "❤️", "😂", "🎉", "😮", "👏", "🦆"] as const;
const SOUND_EMOJI = new Set(["🦆"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Local echo channel: the button tells the overlay to animate without a
// network round-trip (lossy data isn't echoed back to the sender).
type Listener = (emoji: string) => void;
const localListeners = new Set<Listener>();

function maybePlaySound(emoji: string) {
  if (!SOUND_EMOJI.has(emoji)) return;
  if (!useAudioSettings.getState().reactionSounds) return;
  playQuack();
}

/** Floating-emoji overlay; mount once inside the (relative) call stage. */
export function CallReactionOverlay() {
  const room = useRoomContext();
  const [flying, setFlying] = useState<{ id: number; emoji: string; x: number; delay: number; size: number }[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const spawn = (emoji: string) => {
      const id = nextId.current++;
      setFlying((f) => [
        ...f.slice(-40), // hard cap so a spam war can't grow the DOM unbounded
        { id, emoji, x: 8 + Math.random() * 84, delay: Math.random() * 120, size: 26 + Math.random() * 14 },
      ]);
      setTimeout(() => setFlying((f) => f.filter((r) => r.id !== id)), 2600);
    };

    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(decoder.decode(payload)) as { t?: string; emoji?: string };
        if (msg.t !== "callReaction" || !msg.emoji || msg.emoji.length > 16) return;
        spawn(msg.emoji);
        maybePlaySound(msg.emoji);
      } catch {
        /* not ours */
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    localListeners.add(spawn);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      localListeners.delete(spawn);
    };
  }, [room]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {flying.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-0 font-emoji"
          style={{
            left: `${r.x}%`,
            fontSize: r.size,
            animation: `call-reaction-float 2.5s ease-out ${r.delay}ms forwards`,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

/** Control-tray button + quick-emoji popover. Styled like CallStage's buttons. */
export function CallReactionButton() {
  const room = useRoomContext();
  const [open, setOpen] = useState(false);

  const send = (emoji: string) => {
    // Spam is the feature - no throttle. Lossy: dropped frames are fine.
    void room.localParticipant
      .publishData(encoder.encode(JSON.stringify({ t: "callReaction", emoji })), { reliable: false })
      .catch(() => {});
    localListeners.forEach((l) => l(emoji));
    maybePlaySound(emoji);
  };

  return (
    <span className="relative">
      <Tooltip label="React">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Send a reaction"
          aria-pressed={open}
          className={cn(
            "grid size-11 place-items-center rounded-card transition-colors",
            open ? "bg-ink text-paper hover:bg-ink-hover" : "bg-field text-ink hover:bg-line",
          )}
        >
          <SmilePlus className="size-5" />
        </button>
      </Tooltip>
      {open && (
        <div className="absolute bottom-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-card border border-line bg-paper p-1 shadow-[var(--st-shadow-card)]">
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => send(e)}
              aria-label={`React ${e}`}
              title={SOUND_EMOJI.has(e) ? "With sound" : undefined}
              className="grid size-9 place-items-center rounded-control font-emoji text-[20px] transition-transform hover:scale-125 hover:bg-field"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
