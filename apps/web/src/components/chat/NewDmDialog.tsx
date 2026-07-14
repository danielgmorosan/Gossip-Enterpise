import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, UserPlus, Loader2 } from "lucide-react";
import { Button, Field, Input, StackModal, ModalBody } from "@gossip/ui/stack";
import { gossipSdk } from "@/lib/sdk";
import { useContacts } from "@/stores/useContacts";
import { useSession } from "@/stores/useSession";

export function NewDmDialog({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
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
      nav(`/home/dm/${encodeURIComponent(peerId.trim())}`);
    } else {
      setError(res.error ?? "Failed");
    }
  };

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">New direct message</h2>

        {/* Share your ID */}
        <div className="mb-4 rounded-card border border-line bg-field p-3">
          <div className="mb-1 text-[12px] font-medium text-ink-mute">Your user ID — share it so others can message you</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{myId || "open a session first"}</code>
            <button
              disabled={!myId}
              onClick={() => {
                navigator.clipboard?.writeText(myId);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              aria-label="Copy your user ID"
              className="grid size-8 shrink-0 place-items-center rounded-control border border-line text-ink-mute hover:bg-paper hover:text-ink"
            >
              {copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Their user ID">
            <Input className="font-mono" placeholder="gossip1…" value={peerId} onChange={(e) => setPeerId(e.target.value)} autoFocus />
          </Field>
          <Field label="Name (optional)">
            <Input placeholder="e.g. Kevin" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" block disabled={busy || !peerId.trim()}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Adding…</> : <><UserPlus className="size-4" /> Start chat</>}
          </Button>
        </form>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
          The other person must have opened their app at least once (to publish their key). Messages
          send once a secure session is established between you both.
        </p>
      </ModalBody>
    </StackModal>
  );
}
