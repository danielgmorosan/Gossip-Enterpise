/** URL extraction for link previews (T3). Mirrors MessageBody's linkifier. */

const URL_RE = /https?:\/\/[^\s<>"]+/g;
const TRAIL = /[.,!?;:)\]}>"']+$/;

/**
 * URLs worth previewing in `text`, in order, deduped, capped. Code spans and
 * fenced blocks are stripped first - a URL inside code is being *shown*, not
 * shared.
 */
export function extractUrls(text: string, cap = 2): string[] {
  const stripped = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
  const seen = new Set<string>();
  for (const raw of stripped.match(URL_RE) ?? []) {
    const url = raw.replace(TRAIL, "");
    try {
      new URL(url); // drop mangled matches
      seen.add(url);
    } catch {
      /* not a real URL */
    }
    if (seen.size >= cap) break;
  }
  return [...seen];
}

/** YouTube video id from any of the usual URL shapes; null for other links. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = /^\/(embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}
