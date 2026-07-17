import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hash, Lock, ShieldCheck, SearchX, Loader2 } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { SearchHeader, SearchResultRow, PaneEmptyState } from "@umbry/ui/stack";
import { useRelay, relayAuthHeader } from "@/stores/useRelay";
import { relayUrl } from "@/lib/relayBase";
import { formatTime } from "@/lib/utils";

interface SearchHit {
  id: string;
  channelId: string;
  channelName: string;
  channelType: string;
  senderName: string;
  body: string;
  ts: number;
  threadRootId: string | null;
}

/**
 * Workspace search (T4): server-side over the FULL persisted channel history
 * (identity-scoped - the relay only searches channels you can read). Falls
 * back to searching locally-loaded messages if the relay call fails.
 */
export function SearchPage() {
  const { workspaceId = "" } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const workspace = useRelay((s) => s.workspace);
  const messagesByChannel = useRelay((s) => s.messagesByChannel);

  // Fallback: whatever history this client happens to have loaded.
  const localResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const channelName = (id: string) => workspace?.channels.find((c) => c.id === id)?.name ?? id;
    return Object.values(messagesByChannel)
      .flat()
      .filter((m) => m.workspaceId === workspaceId && !m.deleted && m.body.toLowerCase().includes(needle))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 50)
      .map((m) => ({
        id: m.id,
        channelId: m.channelId,
        channelName: channelName(m.channelId),
        channelType: "public",
        senderName: m.senderName,
        body: m.body,
        ts: m.ts,
        threadRootId: m.threadRootId ?? null,
      }));
  }, [q, messagesByChannel, workspace, workspaceId]);

  // Debounced server-side search.
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits(null);
      setBusy(false);
      setNote(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      const run = async () => {
        try {
          const res = await fetch(
            relayUrl(`/search?workspaceId=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(needle)}`),
            { headers: relayAuthHeader() },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "search failed");
          setHits(data.results as SearchHit[]);
          setNote(null);
        } catch (e) {
          // Relay unavailable or session not proven: degrade to local history.
          setHits(null);
          setNote(e instanceof Error ? e.message : "Server search unavailable - showing loaded messages only.");
        } finally {
          setBusy(false);
        }
      };
      void run();
    }, 300);
    return () => clearTimeout(t);
  }, [q, workspaceId]);

  const results = hits ?? localResults;
  const serverBacked = hits !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader title="Search" subtitle="Across channels you can access" />
      <SearchHeader value={q} onChange={setQ} placeholder="Search channel messages…" />
      <div className="flex items-center gap-2 border-b border-line bg-paper-2 px-4 py-2 text-[12.5px] text-ink-mute">
        <ShieldCheck className="size-4 shrink-0 text-positive" />
        Search never includes your end-to-end encrypted DMs, only channel content you already have access to.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {q.trim().length < 2 ? (
          <PaneEmptyState
            icon={<SearchX />}
            title="Search your channels"
            description="Type at least two characters to search the full history of this workspace."
          />
        ) : busy && results.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-ink-faint">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </div>
        ) : results.length === 0 ? (
          <PaneEmptyState
            icon={<SearchX />}
            title="No matches"
            description={`Nothing you can access matches "${q.trim()}".`}
          />
        ) : (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {results.length} result{results.length === 1 ? "" : "s"}
              {serverBacked ? " · full history" : " · loaded messages only"}
              {busy && <Loader2 className="size-3 animate-spin" />}
            </div>
            {note && <div className="px-4 pb-2 text-[12px] text-ink-faint">{note}</div>}
            {results.map((r) => (
              <SearchResultRow
                key={r.id}
                type={r.threadRootId ? "reply" : "message"}
                icon={r.channelType === "private" ? <Lock /> : <Hash />}
                meta={`#${r.channelName} · ${r.senderName}`}
                title={r.body.length > 120 ? r.body.slice(0, 120) + "…" : r.body}
                time={formatTime(new Date(r.ts))}
                onClick={() =>
                  nav(
                    r.threadRootId
                      ? `/w/${workspaceId}/c/${r.channelId}?thread=${r.threadRootId}`
                      : `/w/${workspaceId}/c/${r.channelId}`,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
