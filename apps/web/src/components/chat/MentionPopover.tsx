import { useEffect, useRef } from "react";
import { AtSign } from "lucide-react";
import { UserAvatar as Avatar } from "@/components/UserAvatar";
import { cn, truncateHandle } from "@/lib/utils";

export interface MentionCandidate {
  /** Stable member/contact id (gossip1…). */
  id: string;
  name: string;
}

/**
 * @mention picker (T2-05). Purely presentational: the composer owns the
 * query, filtering, and keyboard state, and drives this listbox via
 * activeIndex - options carry ids so the textarea can point at the active
 * one with aria-activedescendant.
 */
export function MentionPopover({
  candidates,
  activeIndex,
  listboxId,
  onSelect,
  onHover,
  className,
}: {
  candidates: MentionCandidate[];
  activeIndex: number;
  listboxId: string;
  onSelect: (c: MentionCandidate) => void;
  onHover: (index: number) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className={cn("st-pop-in w-72 rounded-card border border-line bg-paper p-1 font-stack shadow-[var(--st-shadow-card)]", className)}>
      <div className="flex items-center gap-1 px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
        <AtSign className="size-3" /> Mention
      </div>
      <ul ref={listRef} id={listboxId} role="listbox" aria-label="Mention a member" className="max-h-56 overflow-y-auto">
        {candidates.map((c, i) => (
          <li key={c.id} id={`${listboxId}-opt-${i}`} role="option" aria-selected={i === activeIndex} data-active={i === activeIndex}>
            <button
              type="button"
              // Keep the textarea's focus/selection while picking.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(c)}
              onMouseEnter={() => onHover(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[13px] transition-colors",
                i === activeIndex ? "bg-field text-ink" : "text-ink-mute",
              )}
            >
              <Avatar name={c.name} id={c.id} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-ink-faint">{truncateHandle(c.id, 8, 4)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
