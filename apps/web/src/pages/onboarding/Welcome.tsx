import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@gossip/ui/stack";

export function Welcome() {
  return (
    <div>
      <h1 className="text-[26px] font-bold tracking-tight text-ink">Get started</h1>
      <p className="mt-1.5 text-[14px] text-ink-mute">
        Create a private workspace or join one you've been invited to. No email, no phone number.
      </p>

      <div className="mt-8 space-y-3">
        <Link to="/identity/create?next=create" className="block">
          <div className="group flex items-center gap-4 rounded-card border border-line bg-paper-2 p-4 transition-colors hover:border-line-strong hover:bg-field">
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-ink text-paper">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">Create a workspace</div>
              <div className="text-[13px] text-ink-mute">Generate an identity and start fresh.</div>
            </div>
            <ArrowRight className="size-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link to="/identity/create?next=join" className="block">
          <div className="group flex items-center gap-4 rounded-card border border-line bg-paper-2 p-4 transition-colors hover:border-line-strong hover:bg-field">
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-field text-ink">
              <KeyRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">Join with an invite</div>
              <div className="text-[13px] text-ink-mute">Use an invite link or code.</div>
            </div>
            <ArrowRight className="size-5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-line pt-5 text-[13px]">
        <span className="text-ink-mute">Already have an identity?</span>
        <Link to="/identity/unlock">
          <Button variant="ghost" size="sm">
            Unlock <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>

      {import.meta.env.DEV && (
        <p className="mt-6 text-center text-[12px] text-ink-faint">
          <Link to="/dev/styleguide" className="underline underline-offset-2 hover:text-ink-mute">
            Stack design system styleguide
          </Link>
        </p>
      )}
    </div>
  );
}
