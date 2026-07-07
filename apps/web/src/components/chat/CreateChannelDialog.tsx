import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, Lock, Loader2 } from "lucide-react";
import { Button, Field, Input, StackModal, ModalBody } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { cn } from "@/lib/utils";

export function CreateChannelDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const nav = useNavigate();
  const createChannel = useRelay((s) => s.createChannel);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createChannel(workspaceId, name, type, topic);
    setBusy(false);
    if (res.ok) {
      onClose();
      nav(`/w/${workspaceId}/c/${res.channel.id}`);
    } else setError(res.error);
  };

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Create a channel</h2>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Name">
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input autoFocus className="pl-10" placeholder="e.g. marketing" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </Field>
          <Field label="Topic (optional)">
            <Input placeholder="What's this channel about?" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {(["public", "private"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex items-center gap-2 rounded-control border p-3 text-left text-[13px] transition-colors",
                  type === t ? "border-ink bg-field text-ink" : "border-line text-ink-mute hover:border-line-strong",
                )}
              >
                {t === "public" ? <Hash className="size-4" /> : <Lock className="size-4" />}
                <span className="capitalize">{t}</span>
              </button>
            ))}
          </div>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" block disabled={busy || !name.trim()}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Creating…</> : "Create channel"}
          </Button>
        </form>
      </ModalBody>
    </StackModal>
  );
}
