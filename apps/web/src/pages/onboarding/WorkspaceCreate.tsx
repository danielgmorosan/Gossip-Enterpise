import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Server, ChevronDown, Loader2 } from "lucide-react";
import { Button, Field, Input } from "@gossip/ui";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/useSession";

export function WorkspaceCreate() {
  const nav = useNavigate();
  const { mnemonic, unlock, setDisplayName } = useSession();
  const [name, setName] = useState("");
  const [yourName, setYourName] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mnemonic) {
      // No identity in memory (e.g. refresh) — go back to create one.
      nav("/identity/create");
      return;
    }
    if (yourName.trim()) setDisplayName(yourName.trim());
    setBusy(true);
    setError(null);
    const ok = await unlock(mnemonic);
    setBusy(false);
    if (ok) nav("/w/w_gossip/c/c_design");
    else setError("Couldn't open a session. Check your connection and try again.");
  };

  return (
    <div>
      <Link to="/identity/create" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">Step 2 of 2 · Workspace</div>
      <h2 className="mt-1 font-display text-[28px] font-bold tracking-tight text-text">Name your workspace</h2>
      <p className="mt-1.5 text-[14px] text-muted">You can change this anytime in settings.</p>

      <form onSubmit={submit} className="mt-7 space-y-5">
        <Field label="Your name" hint="Shown to others in group channels.">
          <Input autoFocus placeholder="e.g. Daniel" value={yourName} onChange={(e) => setYourName(e.target.value)} />
        </Field>

        <Field label="Workspace name">
          <Input
            placeholder="e.g. Gossip Labs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-text"
          >
            <ChevronDown className={cn("size-4 transition-transform", !advanced && "-rotate-90")} />
            Advanced · message relay
          </button>
          {advanced && (
            <div className="mt-3 rounded-xl border border-border bg-surface-inset p-4">
              <Field
                label="Relay base URL"
                hint="Where channel transport is routed. Self-host this for full data control — E2E DMs are unaffected by where the relay lives."
              >
                <Input mono icon={<Server />} defaultValue="https://api.usegossip.com" />
              </Field>
            </div>
          )}
        </div>

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <Button block size="lg" type="submit" disabled={!name.trim() || busy}>
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating your identity…
            </>
          ) : (
            <>
              Create workspace <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
