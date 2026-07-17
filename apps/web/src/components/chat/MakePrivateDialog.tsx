import { useState } from "react";
import { Lock, KeyRound, Loader2, Users } from "lucide-react";
import { Button, Field, PasswordInput, StackModal, ModalBody } from "@umbry/ui/stack";
import { useRelay, type RelayChannel } from "@/stores/useRelay";
import { cn } from "@/lib/utils";

/**
 * Confirm converting a public channel to private, with an explicit membership
 * choice - keeping everyone silently was read as "private channels auto-add
 * the whole Space", so the converter now decides who starts inside.
 */
export function MakePrivateDialog({
  workspaceId,
  channel,
  onClose,
}: {
  workspaceId: string;
  channel: RelayChannel;
  onClose: () => void;
}) {
  const [membership, setMembership] = useState<"everyone" | "self">("self");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await useRelay.getState().makeChannelPrivate(workspaceId, channel.id, password.trim(), membership);
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error);
  };

  const options = [
    { id: "self" as const, icon: Lock, label: "Only me", desc: "Start invite-only; add people from the member list." },
    { id: "everyone" as const, icon: Users, label: "Everyone here", desc: "Keep all current workspace members inside." },
  ];

  return (
    <StackModal onClose={onClose} width="md">
      <ModalBody>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight text-ink">
          <Lock className="size-4" /> Make #{channel.name} private
        </h2>
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-mute">
          Private channels are invite-only and enforced by the relay. Who should be in it to start?
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMembership(o.id)}
                className={cn(
                  "rounded-control border p-3 text-left transition-colors",
                  membership === o.id ? "border-ink bg-field text-ink" : "border-line text-ink-mute hover:border-line-strong",
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <o.icon className="size-4" /> {o.label}
                </span>
                <span className="mt-1 block text-[11.5px] leading-snug text-ink-faint">{o.desc}</span>
              </button>
            ))}
          </div>
          <Field
            label="Join password (optional)"
            hint="With a password, anyone in the workspace who knows it can join. Without one, it's strictly invite-only."
          >
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-faint" />
              <PasswordInput className="pl-10" placeholder="Leave empty for invite-only" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </Field>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <Button type="submit" block disabled={busy}>
            {busy ? <><Loader2 className="size-4 animate-spin" /> Converting…</> : "Make private"}
          </Button>
        </form>
      </ModalBody>
    </StackModal>
  );
}
