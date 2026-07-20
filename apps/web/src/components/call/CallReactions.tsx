import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SmilePlus } from "lucide-react";
import { RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { Tooltip } from "@umbry/ui/stack";
import { playSound, type SoundName } from "@/lib/sounds";
import { useAudioSettings } from "@/stores/useAudioSettings";
import { cn } from "@/lib/utils";

/**
 * In-call reactions + soundboard (T4), Discord-style: tap to spray an emoji
 * over the stage for everyone, or fire a soundboard clip that plays on every
 * participant's machine. Rides LiveKit's lossy data channel - ephemeral, no
 * server or store involved. Recipients can mute soundboard clips in
 * Settings → Calls (reactionSounds).
 */

// Visual-only quick reactions.
const REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "👏", "🔥", "💯"] as const;
// Soundboard: emoji + a synthesized sound everyone hears.
const SOUNDBOARD: { emoji: string; sound: SoundName; label: string }[] = [
  { emoji: "🦆", sound: "quack", label: "Quack" },
  { emoji: "🦗", sound: "crickets", label: "Crickets" },
  { emoji: "👏", sound: "applause", label: "Applause" },
  { emoji: "📣", sound: "airhorn", label: "Airhorn" },
  { emoji: "🥁", sound: "drumroll", label: "Drumroll" },
  { emoji: "🔔", sound: "bell", label: "Bell" },
];

interface ReactionMsg {
  t: "callReaction";
  emoji: string;
  sound?: SoundName;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Local echo channel: the button tells the overlay to animate without a
// network round-trip (lossy data isn't echoed back to the sender).
type Listener = (emoji: string) => void;
const localListeners = new Set<Listener>();

function maybePlaySound(sound: SoundName | undefined) {
  if (!sound) return;
  if (!useAudioSettings.getState().reactionSounds) return;
  playSound(sound);
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
        const msg = JSON.parse(decoder.decode(payload)) as Partial<ReactionMsg>;
        if (msg.t !== "callReaction" || !msg.emoji || msg.emoji.length > 16) return;
        spawn(msg.emoji);
        maybePlaySound(msg.sound as SoundName | undefined);
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

/** Control-tray button + reactions/soundboard popover. */
export function CallReactionButton() {
  const room = useRoomContext();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // The control tray scrolls horizontally (overflow-x-auto), which also clips
  // vertically - an in-flow popover above the button was invisible. Portal it
  // to the body and position it as `fixed`, anchored to the button.
  const [pos, setPos] = useState<{ left: number; bottom: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = 256; // w-64
      const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
      // Cap the panel to the space above the button and let it scroll — the panel
      // grows upward from the tray, so without this its top rows render above the
      // viewport (y < 0) and get clipped with no way to reach them.
      setPos({ left, bottom: window.innerHeight - r.top + 8, maxHeight: Math.max(120, r.top - 16) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  // Close on outside pointer-down or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fire = (emoji: string, sound?: SoundName) => {
    // Spam is the feature - no throttle. Lossy: dropped frames are fine.
    const msg: ReactionMsg = { t: "callReaction", emoji, ...(sound ? { sound } : {}) };
    void room.localParticipant.publishData(encoder.encode(JSON.stringify(msg)), { reliable: false }).catch(() => {});
    localListeners.forEach((l) => l(emoji));
    maybePlaySound(sound);
  };

  return (
    <span ref={wrapRef} className="relative">
      <Tooltip label="React & soundboard">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen((v) => !v)}
          aria-label="Reactions and soundboard"
          aria-pressed={open}
          className={cn(
            "grid size-11 place-items-center rounded-card transition-colors max-md:size-10",
            open ? "bg-ink text-paper hover:bg-ink-hover" : "bg-field text-ink hover:bg-line",
          )}
        >
          <SmilePlus className="size-5" />
        </button>
      </Tooltip>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ left: pos.left, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            className="fixed z-[70] w-64 overflow-y-auto rounded-card border border-line bg-paper p-2 font-stack shadow-[var(--st-shadow-card)]"
          >
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Reactions</div>
          <div className="grid grid-cols-8 gap-0.5">
            {REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => fire(e)}
                aria-label={`React ${e}`}
                className="grid size-7 place-items-center rounded-control font-emoji text-[18px] transition-transform hover:scale-125 hover:bg-field"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mb-1 mt-2.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
            Soundboard
          </div>
          <div className="grid grid-cols-3 gap-1">
            {SOUNDBOARD.map((s) => (
              <button
                key={s.sound}
                onClick={() => fire(s.emoji, s.sound)}
                aria-label={`Play ${s.label}`}
                className="flex flex-col items-center gap-0.5 rounded-control border border-line px-1 py-1.5 transition-colors hover:border-line-strong hover:bg-field"
              >
                <span className="font-emoji text-[18px]">{s.emoji}</span>
                <span className="text-[10px] font-medium text-ink-mute">{s.label}</span>
              </button>
            ))}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
