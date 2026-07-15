import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hash, Lock, KeyRound, Loader2 } from "lucide-react";
import { Button, Field, Input, PasswordInput, StackModal, ModalBody } from "@gossip/ui/stack";
import { useRelay } from "@/stores/useRelay";
import { useSession } from "@/stores/useSession";
import { useUnlockPrompt } from "@/components/UnlockDialog";
import { cn } from "@/lib/utils";

export function CreateChannelDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const nav = useNavigate();
  const createChannel = useRelay((s) => s.createChannel);
  const sessionOpen = useSession((s) => s.status === "open");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createChannel(workspaceId, name, type, topic, type === "private" ? password.trim() : "");
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

        {!sessionOpen && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-card bg-field p-3">
            <p className="text-[12.5px] leading-snug text-ink-mute">
              Channels are owned by your handle - unlock your session to create one.
            </p>
            <Button size="sm" variant="secondary" onClick={() => useUnlockPrompt.getState().show()}>
              Unlock
            </Button>
          </div>
        )}

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
          {type === "private" && (
            <Field
              label="Join password (optional)"
              hint="With a password, anyone in the workspace who knows it can join. Without one, it's strictly invite-only."
            >
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-faint" />
                <PasswordInput className="pl-10" placeholder="Leave empty for invite-only" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </Field>
          )}
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" block disabled={busy || !name.trim() || !sessionOpen}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Creating…</> : "Create channel"}
          </Button>
        </form>
      </ModalBody>
    </StackModal>
  );
}
