import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { cn } from "../../utils";

export interface AiSkillOption {
  id: string;
  label: string;
  description?: string;
}

export interface AiPromptComposerProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onSubmit"> {
  /** Active skill/context shown as a removable chip above the textarea. */
  activeSkill?: AiSkillOption | null;
  onSkillRemove?: () => void;
  skills?: AiSkillOption[];
  onSkillSelect?: (skill: AiSkillOption) => void;
  onAttach?: () => void;
  onSubmit?: () => void;
  /** When true, send is disabled and shows a stop affordance. */
  busy?: boolean;
  attachLabel?: string;
  skillsLabel?: string;
}

const SendIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden className="size-4">
    <path
      fill="currentColor"
      d="M8 3.5a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L7.5 9.793V4a.5.5 0 0 1 .5-.5Z"
    />
  </svg>
);

function IconButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-control text-ink-mute",
        "transition-colors hover:bg-field hover:text-ink",
        "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const AiPromptComposer = forwardRef<HTMLTextAreaElement, AiPromptComposerProps>(
  (
    {
      activeSkill,
      onSkillRemove,
      skills = [],
      onSkillSelect,
      onAttach,
      onSubmit,
      busy,
      attachLabel = "Attach file",
      skillsLabel = "Skills",
      className,
      value,
      onChange,
      placeholder = "Ask Gossip…",
      disabled,
      rows = 1,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const [skillsOpen, setSkillsOpen] = useState(false);
    const skillsRef = useRef<HTMLDivElement>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
    }, []);

    useEffect(() => {
      resize();
    }, [value, resize]);

    useEffect(() => {
      if (!skillsOpen) return;
      const onDoc = (e: MouseEvent) => {
        if (skillsRef.current && !skillsRef.current.contains(e.target as Node)) {
          setSkillsOpen(false);
        }
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, [skillsOpen]);

    const canSend = Boolean(String(value ?? "").trim()) && !disabled && !busy;

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) onSubmit?.();
      }
      props.onKeyDown?.(e);
    };

    return (
      <div
        className={cn(
          "rounded-card border border-line bg-paper shadow-[var(--st-shadow-card)]",
          "transition-[border-color,box-shadow] focus-within:border-line-strong",
          className,
        )}
      >
        {activeSkill && (
          <div className="flex flex-wrap gap-2 border-b border-line px-4 pt-3.5 pb-2">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-control bg-field px-2.5 py-1 text-[13px] font-medium text-ink">
              <span className="truncate">{activeSkill.label}</span>
              {onSkillRemove && (
                <button
                  type="button"
                  aria-label={`Remove ${activeSkill.label}`}
                  onClick={onSkillRemove}
                  className="rounded-sm text-ink-mute hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </span>
          </div>
        )}

        <textarea
          ref={setRefs}
          rows={rows}
          value={value}
          onChange={(e) => {
            onChange?.(e);
            resize();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "block w-full resize-none bg-transparent px-4 pt-4 pb-2",
            "text-[15px] leading-relaxed text-ink placeholder:text-ink-faint",
            "outline-none min-h-[52px]",
          )}
          {...props}
        />

        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <div ref={skillsRef} className={cn("relative", skills.length === 0 && "invisible")}>
            <button
              type="button"
              onClick={() => setSkillsOpen((o) => !o)}
              disabled={disabled || skills.length === 0}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-control px-2.5",
                "text-[13px] font-medium text-ink-mute",
                "transition-colors hover:bg-field hover:text-ink",
                "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <span className="size-4 rounded-sm border border-line-strong bg-field" />
              {skillsLabel}
              <ChevronDown className={cn("size-3.5 transition-transform", skillsOpen && "rotate-180")} />
            </button>

            {skillsOpen && skills.length > 0 && (
              <div
                role="menu"
                className={cn(
                  "absolute bottom-full left-0 z-20 mb-2 min-w-[260px] overflow-hidden",
                  "rounded-card border border-line bg-paper py-1 shadow-[var(--st-shadow-card)]",
                )}
              >
                <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                  Your skills
                </p>
                {skills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSkillSelect?.(skill);
                      setSkillsOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                      "text-[13px] text-ink hover:bg-field transition-colors",
                    )}
                  >
                    <span className="font-medium">{skill.label}</span>
                    {skill.description && (
                      <span className="text-ink-mute line-clamp-1">{skill.description}</span>
                    )}
                  </button>
                ))}
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-[13px] text-ink-mute hover:bg-field hover:text-ink"
                >
                  Manage skills
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onAttach && (
              <IconButton label={attachLabel} onClick={onAttach} disabled={disabled}>
                <Paperclip className="size-4" strokeWidth={1.75} />
              </IconButton>
            )}
            <button
              type="button"
              aria-label={busy ? "Stop" : "Send message"}
              disabled={!canSend && !busy}
              onClick={onSubmit}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full",
                "bg-ink text-paper transition-colors",
                "hover:bg-ink-hover outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-ring)]",
                "disabled:bg-field disabled:text-ink-faint",
              )}
            >
              {busy ? (
                <span className="size-2.5 rounded-[2px] bg-current" />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  },
);
AiPromptComposer.displayName = "AiPromptComposer";
