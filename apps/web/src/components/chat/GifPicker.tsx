import { useEffect, useRef, useState } from "react";
import { Search, Loader2, X, Clock } from "lucide-react";
import { relayUrl } from "@/lib/relayBase";
import { useRecentGifs, type RecentGif } from "@/stores/useRecentGifs";
import { cn } from "@/lib/utils";

type Gif = RecentGif;

const memo = new Map<string, Gif[]>();
async function searchGifs(q: string): Promise<{ gifs: Gif[]; needsKey?: boolean }> {
  const key = q.trim().toLowerCase();
  const cached = memo.get(key);
  if (cached) return { gifs: cached };
  try {
    const r = await fetch(relayUrl(`/gif-search?q=${encodeURIComponent(q)}`));
    const d = await r.json();
    const gifs: Gif[] = d.gifs ?? [];
    if (gifs.length) memo.set(key, gifs);
    return { gifs, needsKey: d.needsKey };
  } catch {
    return { gifs: [] };
  }
}

/**
 * GIF picker (T3). Searches via the relay proxy (Giphy) and calls onPick with
 * the GIF's direct URL - it renders inline in the message via the existing
 * image path. In DMs the URL travels inside the encrypted message and the
 * recipient loads it straight from the GIF host.
 */
export function GifPicker({ onPick, onClose, className }: { onPick: (url: string) => void; onClose: () => void; className?: string }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);
  const recent = useRecentGifs((s) => s.recent);
  const pushRecent = useRecentGifs((s) => s.push);
  const showRecent = !query.trim() && recent.length > 0;

  const pick = (g: Gif) => {
    pushRecent(g);
    onPick(g.url);
    onClose();
  };

  useEffect(() => {
    let on = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchGifs(query);
      if (on) {
        setGifs(res.gifs);
        setNeedsKey(!!res.needsKey);
        setLoading(false);
      }
    }, query ? 350 : 0); // debounce searches; load trending immediately
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [query]);

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn("w-80 rounded-card border border-line bg-paper p-2 font-stack shadow-[var(--st-shadow-card)]", className)}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs"
            className="w-full rounded-control border border-line bg-field py-1.5 pl-8 pr-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
          />
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-7 shrink-0 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <div className="h-64 overflow-y-auto">
        {showRecent ? (
          <>
            <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              <Clock className="size-3" /> Recently used
            </div>
            <div className="columns-2 gap-2 [&>*]:mb-2">
              {recent.map((g) => (
                <button
                  key={g.id}
                  onClick={() => pick(g)}
                  className="block w-full overflow-hidden rounded-control border border-transparent transition-colors hover:border-line-strong"
                >
                  <img src={g.preview} alt="" loading="lazy" className="w-full" />
                </button>
              ))}
            </div>
          </>
        ) : loading ? (
          <div className="grid h-full place-items-center text-ink-faint">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : needsKey ? (
          <div className="px-3 py-6 text-center text-[12.5px] leading-relaxed text-ink-mute">
            GIF search needs a free API key. Add <span className="font-mono text-ink">GIPHY_API_KEY</span> (from
            developers.giphy.com) to <span className="font-mono text-ink">services/relay/.env</span> and restart the relay.
            <div className="mt-2 text-ink-faint">You can still paste a GIF URL into any message - it renders inline.</div>
          </div>
        ) : gifs.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] text-ink-faint">No GIFs found.</p>
        ) : (
          <div className="columns-2 gap-2 [&>*]:mb-2">
            {gifs.map((g) => (
              <button
                key={g.id}
                onClick={() => pick(g)}
                className="block w-full overflow-hidden rounded-control border border-transparent transition-colors hover:border-line-strong"
              >
                <img src={g.preview} alt="" loading="lazy" className="w-full" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pt-1.5 text-center text-[10px] text-ink-faint">Powered by GIPHY</div>
    </div>
  );
}
