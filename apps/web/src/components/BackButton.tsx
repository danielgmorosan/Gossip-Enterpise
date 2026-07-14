import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";

/**
 * Shared back affordance (T2-03). Always targets an EXPLICIT parent route
 * rather than history.back(), so a fresh deep-link load still lands somewhere
 * sensible. Place it top-left in the page/panel header.
 */
export function BackButton({ to, label = "Back" }: { to: string; label?: string }) {
  return (
    <Tooltip label={label} side="bottom">
      <Link
        to={to}
        aria-label={label}
        className="grid size-8 place-items-center rounded-control text-ink-faint transition-colors outline-none hover:bg-field hover:text-ink focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]"
      >
        <ArrowLeft className="size-4" />
      </Link>
    </Tooltip>
  );
}
