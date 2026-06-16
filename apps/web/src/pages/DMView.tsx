import { useParams, Link } from "react-router-dom";
import { Phone, ShieldCheck, Info, Video, Check, CheckCheck } from "lucide-react";
import { PaneHeader, HeaderIconButton } from "@/components/chat/PaneHeader";
import { Composer } from "@/components/chat/Composer";
import { Avatar, Badge } from "@gossip/ui";
import { dms, memberById } from "@/data/mock";
import { cn, truncateHandle } from "@/lib/utils";
import { RealDmView } from "@/components/chat/RealDmView";
import { useContacts } from "@/stores/useContacts";

function contactName(userId: string): string | undefined {
  return useContacts.getState().contacts.find((c) => c.userId === userId)?.name;
}

interface Bubble {
  mine: boolean;
  body: string;
  ts: string;
  read?: boolean;
}

const convo: Bubble[] = [
  { mine: false, body: "Pushed the relay seam — take a look when you get a sec.", ts: "09:41" },
  { mine: false, body: "It only touches channel transport. DMs like this one stay on the gossip-sdk E2E channel.", ts: "09:41" },
  { mine: true, body: "Perfect. That's the boundary I wanted to keep clean.", ts: "09:44", read: true },
  { mine: true, body: "Can you add a per-workspace relay URL setting too?", ts: "09:44", read: true },
  { mine: false, body: "Already there — defaults to api.usegossip.com, override for self-host.", ts: "09:46" },
  { mine: true, body: "🔥", ts: "09:47", read: false },
];

export function DMView() {
  const { workspaceId = "w_gossip", dmId = "dm_kev" } = useParams();

  // Real, SDK-backed conversations.
  if (dmId === "dm_self") return <RealDmView peerId="self" />;
  if (dmId.startsWith("gossip1")) return <RealDmView peerId={dmId} peerName={contactName(dmId)} />;

  const dm = dms.find((d) => d.id === dmId) ?? dms[0];
  const peer = memberById(dm.memberId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PaneHeader
        icon={<Avatar name={peer.displayName} id={peer.id} size={28} presence={peer.presence} />}
        title={peer.displayName}
        subtitle={<span className="font-mono text-[11px]">{truncateHandle(peer.handle, 14, 6)}</span>}
        badge={
          <Badge tone="accent" className="ml-1" dot>
            E2E verified
          </Badge>
        }
        actions={
          <>
            <Link to={`/w/${workspaceId}/call/${dmId}`}>
              <HeaderIconButton label="Audio call">
                <Phone className="size-4" />
              </HeaderIconButton>
            </Link>
            <HeaderIconButton label="Video call">
              <Video className="size-4" />
            </HeaderIconButton>
            <HeaderIconButton label="Details">
              <Info className="size-4" />
            </HeaderIconButton>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* E2E banner */}
        <div className="mx-auto mb-6 flex max-w-lg flex-col items-center gap-2 rounded-2xl border border-[color:var(--accent)]/25 bg-[color:var(--accent-faint)] p-4 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-ink">
            <ShieldCheck className="size-5" />
          </span>
          <div className="text-[14px] font-semibold text-text">End-to-end encrypted</div>
          <p className="text-[12.5px] leading-relaxed text-muted">
            Messages, attachments, and calls with {peer.displayName} are secured with post-quantum
            keys and forward secrecy. No server — and no AI — can read them.
          </p>
          <div className="mt-1 font-mono text-[10px] text-faint">
            key · 7F2A·9C41·B0D8·E532 · matches
          </div>
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {convo.map((b, i) => {
            const prev = convo[i - 1];
            const grouped = prev && prev.mine === b.mine;
            return (
              <div
                key={i}
                className={cn("flex items-end gap-2", b.mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-3")}
              >
                <div className="w-7 shrink-0">
                  {!b.mine && !grouped && <Avatar name={peer.displayName} id={peer.id} size={28} />}
                </div>
                <div
                  className={cn(
                    "relative max-w-[68%] px-3.5 py-2 text-[14.5px] leading-relaxed shadow-sm",
                    b.mine
                      ? "rounded-2xl rounded-br-md bg-accent text-accent-ink"
                      : "rounded-2xl rounded-bl-md bg-slate text-text",
                  )}
                >
                  <span>{b.body}</span>
                  <span
                    className={cn(
                      "ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px]",
                      b.mine ? "text-accent-ink/60" : "text-faint",
                    )}
                  >
                    {b.ts}
                    {b.mine && (b.read ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Composer placeholder={`Message ${peer.displayName}`} e2e />
    </div>
  );
}
