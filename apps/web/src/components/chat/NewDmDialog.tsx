import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Copy, Check, UserPlus, Loader2 } from "lucide-react";
import { Button, Field, Input } from "@gossip/ui";
import { gossipSdk } from "@/lib/sdk";
import { useContacts } from "@/stores/useContacts";
import { useSession } from "@/stores/useSession";

export function NewDmDialog({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const { workspaceId = "w_gossip" } = useParams();
  const status = useSession((s) => s.status);
  const add = useContacts((s) => s.add);
  const myId = status === "open" ? gossipSdk.userId : "";
  const [peerId, setPeerId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await add(peerId, name);
    setBusy(false);
    if (res.ok) {
      onClose();
      nav(`/w/${workspaceId}/dm/${encodeURIComponent(peerId.trim())}`);
    } else {
      setError(res.error ?? "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text">New direct message</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-slate hover:text-text">
            <X className="size-4" />
          </button>
        </div>

        {/* Share your ID */}
        <div className="mb-4 rounded-xl border border-border bg-surface-inset p-3">
          <div className="mb-1 text-[12px] font-medium text-muted">Your user ID — share it so others can message you</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-accent">{myId || "open a session first"}</code>
            <button
              disabled={!myId}
              onClick={() => {
                navigator.clipboard?.writeText(myId);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-text"
            >
              {copied ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Their user ID">
            <Input mono placeholder="gossip1…" value={peerId} onChange={(e) => setPeerId(e.target.value)} autoFocus />
          </Field>
          <Field label="Name (optional)">
            <Input placeholder="e.g. Kevin" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button type="submit" block disabled={busy || !peerId.trim()}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Adding…</> : <><UserPlus className="size-4" /> Start chat</>}
          </Button>
        </form>
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          The other person must have opened their app at least once (to publish their key). Messages
          send once a secure session is established between you both.
        </p>
      </div>
    </div>
  );
}
