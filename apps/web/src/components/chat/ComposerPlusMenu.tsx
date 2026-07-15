import { useEffect, useRef, type ReactNode } from "react";
import { Paperclip, SquareCode, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "+" more-options popover for the composer. Branded (Stack tokens),
 * keyboard-accessible: focus moves into the menu on open, arrow keys rove,
 * Tab is trapped inside, Esc / outside-click closes.
 *
 * "Attach file or media" opens the OS file picker; the actual upload flow is
 * T-13 - until then the caller shows an honest "coming soon" notice and does
 * NOT fake a successful upload. Disabled rows are placeholders for later
 * options, labelled "Soon".
 */
export function ComposerPlusMenu({
  onAttach,
  onClose,
  className,
}: {
  /** Called with the files picked in the OS dialog (may be empty on cancel). */
  onAttach: (files: FileList | null) => void;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Move focus into the menu (first enabled item).
    ref.current?.querySelector<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])")?.focus();

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (target.closest("[data-plus-toggle]")) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  /** Roving focus + Tab trap among enabled menu items. */
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") ?? [],
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      e.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") move(idx + 1);
    else if (e.key === "ArrowUp") move(idx - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Tab") move(idx + (e.shiftKey ? -1 : 1));
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="More options"
      onKeyDown={onMenuKeyDown}
      className={cn(
        "font-stack w-64 overflow-hidden rounded-card border border-line bg-paper p-1.5 shadow-[var(--st-shadow-card)]",
        className,
      )}
    >
      <MenuRow
        icon={<Paperclip className="size-4" />}
        label="Attach file or media"
        hint="From your device"
        onClick={() => fileRef.current?.click()}
      />
      <MenuRow icon={<SquareCode className="size-4" />} label="Code snippet" soon />
      <MenuRow icon={<ListTodo className="size-4" />} label="Poll" soon />
      {/* Native OS picker; hidden. Selection is handed to the caller (T-13 flow). */}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onAttach(e.target.files);
          e.target.value = "";
          onClose();
        }}
      />
    </div>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  soon,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  soon?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={soon || undefined}
      disabled={soon}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors",
        soon
          ? "cursor-default text-ink-faint"
          : "text-ink hover:bg-field focus-visible:bg-field focus-visible:outline-none",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-control", soon ? "bg-field/60" : "bg-field")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium">{label}</span>
        {hint && <span className="block text-[11.5px] text-ink-faint">{hint}</span>}
      </span>
      {soon && (
        <span className="rounded-full bg-field px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
          Soon
        </span>
      )}
    </button>
  );
}
