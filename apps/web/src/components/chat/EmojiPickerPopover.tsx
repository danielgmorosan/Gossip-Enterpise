import { useEffect, useRef } from "react";
import { EmojiPicker } from "frimousse";
import { cn } from "@/lib/utils";

/**
 * Branded emoji picker popover (frimousse, headless) styled with Stack tokens.
 * Glyphs render via the bundled "Noto Color Emoji" font (`.font-emoji`) so the
 * set is consistent across OSes instead of falling back to native emoji.
 *
 * Closes on Escape or outside pointer-down. The composer's toggle button must
 * carry `data-emoji-toggle` so its own click doesn't immediately re-open.
 */
export function EmojiPickerPopover({
  onPick,
  onClose,
  className,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (target.closest("[data-emoji-toggle]")) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Emoji picker" className={cn("font-stack", className)}>
      <EmojiPicker.Root
        onEmojiSelect={({ emoji }) => onPick(emoji)}
        columns={9}
        // Self-hosted emojibase data (apps/web/public/emojibase). frimousse
        // defaults to the jsdelivr CDN, which fails under the app's COEP /
        // offline desktop constraints and violates the no-runtime-CDN rule.
        // Served same-origin so it works everywhere, including the app:// shell.
        emojibaseUrl="/emojibase"
        className="isolate flex h-80 w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card border border-line bg-paper shadow-[var(--st-shadow-card)]"
      >
        <EmojiPicker.Search
          autoFocus
          placeholder="Search emoji…"
          className="z-10 mx-2 mt-2 appearance-none rounded-control border border-line bg-field px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-line-strong focus:ring-2 focus:ring-[color:var(--st-ring)]"
        />
        <EmojiPicker.Viewport className="relative flex-1 outline-none">
          <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-faint">
            Loading emojis…
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-faint">
            No emoji found.
          </EmojiPicker.Empty>
          <EmojiPicker.List
            className="select-none pb-1.5"
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div
                  {...props}
                  className="bg-paper px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-mute"
                >
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div {...props} className="scroll-my-1.5 px-1.5">
                  {children}
                </div>
              ),
              Emoji: ({ emoji, ...props }) => (
                <button
                  {...props}
                  className="font-emoji flex size-8 items-center justify-center rounded-control text-[18px] transition-colors data-[active]:bg-field"
                >
                  {emoji.emoji}
                </button>
              ),
            }}
          />
        </EmojiPicker.Viewport>
      </EmojiPicker.Root>
    </div>
  );
}
