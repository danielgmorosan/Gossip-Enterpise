import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hash, ShieldCheck, SearchX } from "lucide-react";
import { PaneHeader } from "@/components/chat/PaneHeader";
import { SearchHeader, SearchResultRow, PaneEmptyState } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { formatTime } from "@/lib/utils";

export function SearchPage() {
  const { workspaceId = "" } = useParams();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const workspace = useRelay((s) => s.workspace);
  const messagesByChannel = useRelay((s) => s.messagesByChannel);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const channelName = (id: string) => workspace?.channels.find((c) => c.id === id)?.name ?? id;
    return Object.values(messagesByChannel)
      .flat()
      .filter((m) => m.workspaceId === workspaceId && m.body.toLowerCase().includes(needle))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 50)
      .map((m) => ({ ...m, channelName: channelName(m.channelId) }));
  }, [q, messagesByChannel, workspace, workspaceId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader title="Search" subtitle="Across channels you can access" />
      <SearchHeader
        value={q}
        onChange={setQ}
        placeholder="Search channel messages…"
      />
      <div className="flex items-center gap-2 border-b border-line bg-paper-2 px-4 py-2 text-[12.5px] text-ink-mute">
        <ShieldCheck className="size-4 shrink-0 text-positive" />
        Search never includes your end-to-end encrypted DMs — only channel content you already have access to.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {q.trim() === "" ? (
          <PaneEmptyState
            icon={<SearchX />}
            title="Search your channels"
            description="Type above to find messages in the channels of this workspace."
          />
        ) : results.length === 0 ? (
          <PaneEmptyState
            icon={<SearchX />}
            title="No matches"
            description={`Nothing in your loaded channels matches "${q.trim()}". Open a channel to load its history.`}
          />
        ) : (
          <div>
            <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">
              {results.length} result{results.length === 1 ? "" : "s"}
            </div>
            {results.map((r) => (
              <SearchResultRow
                key={r.id}
                type="message"
                icon={<Hash />}
                meta={`#${r.channelName} · ${r.senderName}`}
                title={r.body.length > 120 ? r.body.slice(0, 120) + "…" : r.body}
                time={formatTime(new Date(r.ts))}
                onClick={() => nav(`/w/${workspaceId}/c/${r.channelId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
