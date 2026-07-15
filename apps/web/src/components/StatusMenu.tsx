import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Settings } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useSession } from "@/stores/useSession";
import { useStatus, type PresenceStatus } from "@/stores/useStatus";
import { cn } from "@/lib/utils";

const OPTIONS: { value: PresenceStatus; label: string; desc: string; dot: string }[] = [
  { value: "online", label: "Online", desc: "Others see you as active.", dot: "bg-positive" },
  { value: "invisible", label: "Invisible", desc: "Appear offline; full access stays.", dot: "border-2 border-ink-faint bg-paper" },
];

/**
 * Presence status menu (T3): the rail avatar opens this to switch between
 * Online and Invisible, with a shortcut to profile settings. The avatar shows
 * your own status dot.
 */
export function StatusMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayName = useSession((s) => s.displayName) || "You";
  const userId = useSession((s) => s.userId);
  const status = useStatus((s) => s.status);
  const setStatus = useStatus((s) => s.setStatus);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Set your status" className="block transition-transform hover:scale-105">
        <UserAvatar name={displayName} id={userId ?? displayName} className="!size-9 !text-[13px]" presence />
      </button>
      {open && (
        <div className="absolute bottom-0 left-full z-50 ml-3 w-56 rounded-card border border-line bg-paper p-2 font-stack shadow-[var(--st-shadow-card)]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <UserAvatar name={displayName} id={userId ?? displayName} className="!size-8 !text-[12px]" presence />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">{displayName}</div>
              <div className="text-[11px] capitalize text-ink-faint">{status}</div>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                setStatus(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-field"
            >
              <span className={cn("size-2.5 shrink-0 rounded-full", o.dot)} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-ink">{o.label}</span>
                <span className="block text-[11px] text-ink-faint">{o.desc}</span>
              </span>
              {status === o.value && <Check className="size-4 shrink-0 text-positive" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link
            to="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-control px-2 py-1.5 text-[13px] text-ink-mute transition-colors hover:bg-field hover:text-ink"
          >
            <Settings className="size-4" /> Profile & settings
          </Link>
        </div>
      )}
    </div>
  );
}
