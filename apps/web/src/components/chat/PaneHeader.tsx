import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";

/**
 * Mobile-only back affordance (Discord-style): content pages are full-screen
 * below md, so every pane header returns to the shell's sidebar view - the
 * workspace root inside /w/…, the DM list at /home.
 */
export function MobileBackButton() {
  const { workspaceId } = useParams();
  return (
    <Link
      to={workspaceId ? `/w/${workspaceId}` : "/home"}
      aria-label="Back"
      className="-ml-1.5 grid size-8 shrink-0 place-items-center rounded-control text-ink-mute transition-colors hover:bg-field hover:text-ink md:hidden"
    >
      <ChevronLeft className="size-5" />
    </Link>
  );
}

export function PaneHeader({
  back,
  icon,
  title,
  subtitle,
  badge,
  actions,
}: {
  /** Back affordance slot (top-left, before the icon) - e.g. <BackButton/>. Defaults to the mobile-only back button. */
  back?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-4 max-md:gap-2 max-md:px-3">
      <div className="flex min-w-0 items-center gap-2">
        {back ?? <MobileBackButton />}
        {icon}
        <h1 className="truncate text-[15px] font-semibold text-ink">{title}</h1>
        {badge}
      </div>
      {subtitle && (
        <>
          <div className="h-4 w-px bg-line" />
          <div className="hidden min-w-0 truncate text-[13px] text-ink-mute md:block">{subtitle}</div>
        </>
      )}
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </header>
  );
}

export function HeaderIconButton({
  children,
  active,
  label,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        aria-label={label}
        onClick={onClick}
        className={cn(
          "grid size-8 place-items-center rounded-control transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
          active
            ? "bg-field text-ink"
            : "text-ink-faint hover:bg-field hover:text-ink",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
