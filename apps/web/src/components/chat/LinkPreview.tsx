import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { relayUrl } from "@/lib/relayBase";
import { extractUrls, youtubeId } from "@/lib/linkify";
import { isImageUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Link previews under a message (T3), Discord-style.
 *
 * Channels: metadata comes from the relay's /unfurl (the message already
 * lives on the relay — no new exposure). DMs are E2E: their URLs are never
 * sent to the relay, so DMs only preview YouTube links — the thumbnail and
 * title come straight from YouTube (i.ytimg.com / oEmbed), touching only the
 * host the link already points at.
 */

interface Unfurled {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

const unfurlMemo = new Map<string, Promise<Unfurled>>();
function unfurl(url: string): Promise<Unfurled> {
  let p = unfurlMemo.get(url);
  if (!p) {
    p = fetch(relayUrl(`/unfurl?url=${encodeURIComponent(url)}`))
      .then((r) => (r.ok ? r.json() : { url }))
      .catch(() => ({ url }));
    unfurlMemo.set(url, p);
  }
  return p;
}

const ytTitleMemo = new Map<string, Promise<string | null>>();
function youtubeTitle(url: string): Promise<string | null> {
  let p = ytTitleMemo.get(url);
  if (!p) {
    p = fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.title ?? null)
      .catch(() => null);
    ytTitleMemo.set(url, p);
  }
  return p;
}

function YouTubeCard({ url, videoId }: { url: string; videoId: string }) {
  const [title, setTitle] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let on = true;
    void youtubeTitle(url).then((t) => on && setTitle(t));
    return () => {
      on = false;
    };
  }, [url]);

  return (
    <div className="max-w-md overflow-hidden rounded-card border border-line border-l-2 border-l-negative bg-paper-2 text-left">
      <div className="px-3 pb-1.5 pt-2">
        <div className="text-[11px] text-ink-faint">YouTube</div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-[13.5px] font-semibold text-ink hover:underline"
        >
          {title ?? "Watch on YouTube"}
        </a>
      </div>
      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            title={title ?? "YouTube video"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button onClick={() => setPlaying(true)} aria-label="Play video" className="group absolute inset-0">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-110">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Direct image/GIF link → the image itself, no card chrome. */
function ImageCard({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block w-fit max-w-md">
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-h-72 rounded-card border border-line object-contain"
      />
    </a>
  );
}

function SiteCard({ url }: { url: string }) {
  const [data, setData] = useState<Unfurled | null>(null);

  useEffect(() => {
    let on = true;
    void unfurl(url).then((d) => on && setData(d));
    return () => {
      on = false;
    };
  }, [url]);

  // Nothing worth showing (fetch failed / no metadata) → no card at all.
  if (!data || (!data.title && !data.image)) return null;

  return (
    <div className="max-w-md overflow-hidden rounded-card border border-line border-l-2 border-l-line-strong bg-paper-2 text-left">
      <div className="px-3 pb-2 pt-2">
        {data.siteName && <div className="text-[11px] text-ink-faint">{data.siteName}</div>}
        {data.title && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-[13.5px] font-semibold text-ink hover:underline"
          >
            {data.title}
          </a>
        )}
        {data.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-mute">{data.description}</p>}
      </div>
      {data.image && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block px-3 pb-3">
          <img src={data.image} alt="" loading="lazy" className="max-h-56 rounded-control object-cover" />
        </a>
      )}
    </div>
  );
}

/**
 * The previews for every URL in a message body. `e2e` marks DM content:
 * those URLs never reach the relay (YouTube-only previews).
 */
export function MessagePreviews({ text, e2e, className }: { text: string; e2e?: boolean; className?: string }) {
  const urls = extractUrls(text);
  if (urls.length === 0) return null;
  const cards = urls
    .map((url) => {
      // Direct image/GIF links render inline everywhere — the browser fetches
      // straight from the linked host, same as clicking would.
      if (isImageUrl(url)) return <ImageCard key={url} url={url} />;
      const vid = youtubeId(url);
      if (vid) return <YouTubeCard key={url} url={url} videoId={vid} />;
      if (e2e) return null; // privacy: non-YouTube DM links stay unpreviewd
      return <SiteCard key={url} url={url} />;
    })
    .filter(Boolean);
  if (cards.length === 0) return null;
  return <div className={cn("mt-1.5 flex flex-col gap-1.5", className)}>{cards}</div>;
}
