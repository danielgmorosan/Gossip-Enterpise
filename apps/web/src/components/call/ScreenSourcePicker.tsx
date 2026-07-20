import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Volume2, X } from "lucide-react";
import { useScreenPicker } from "@/lib/desktopScreenPicker";
import { cn } from "@/lib/utils";

/**
 * Desktop-shell replacement for the browser's screen-share picker (see
 * lib/desktopScreenPicker for why we can't use the native one). Mounted once in
 * the app shell; renders only while a share request is pending.
 *
 * Screen-only: per-window capture is unreliable on the Electron/macOS build we
 * ship, so the source list is already filtered to whole screens upstream. When
 * per-app sharing returns (native ScreenCaptureKit) this grows a Window tab
 * back.
 */
export function ScreenSourcePicker() {
  const open = useScreenPicker((s) => s.open);
  const sources = useScreenPicker((s) => s.sources);
  const choose = useScreenPicker((s) => s.choose);
  const [selected, setSelected] = useState<string | null>(null);
  const [audio, setAudio] = useState(true);

  // Fresh request → clean slate. One screen? Preselect it so Share is one click.
  useEffect(() => {
    if (!open) return;
    setAudio(true);
    setSelected(sources.length === 1 ? sources[0].id : null);
  }, [open, sources]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") choose({ id: null, audio: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, choose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4" onMouseDown={() => choose({ id: null, audio: false })}>
      <div
        role="dialog"
        aria-label="Choose a screen to share"
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-panel border border-line bg-paper shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-ink">{sources.length > 1 ? "Choose a screen to share" : "Share your screen"}</h2>
          <button
            onClick={() => choose({ id: null, audio: false })}
            aria-label="Cancel"
            className="ml-auto grid size-7 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {sources.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-mute">No screen available to share.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  onDoubleClick={() => choose({ id: s.id, audio })}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-control border text-left",
                    selected === s.id ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-ink-faint",
                  )}
                >
                  <div className="grid aspect-video place-items-center bg-field">
                    {s.thumbnail ? (
                      <img src={s.thumbnail} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <Monitor className="size-8 text-ink-faint" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5">
                    <Monitor className="size-3.5 shrink-0 text-ink-faint" />
                    <span className="truncate text-[12.5px] text-ink">{s.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-3">
          <label className="flex min-w-0 cursor-pointer items-center gap-2 text-[12.5px] text-ink-mute">
            <input
              type="checkbox"
              checked={audio}
              onChange={(e) => setAudio(e.target.checked)}
              className="size-3.5 shrink-0 accent-accent"
            />
            <span className="inline-flex items-center gap-1 font-medium text-ink">
              <Volume2 className="size-3.5 shrink-0" />
              Share computer audio
            </span>
          </label>
          <button
            onClick={() => choose({ id: null, audio: false })}
            className="ml-auto shrink-0 rounded-control px-3 py-1.5 text-[13px] font-medium text-ink-mute hover:bg-field hover:text-ink"
          >
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => selected && choose({ id: selected, audio })}
            className="shrink-0 rounded-control bg-accent px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Share
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
