import { useRef, useState, type ReactNode } from "react";
import {
  SendHorizontal,
  ShieldCheck,
  Shield,
  Smile,
  Loader2,
  Bold,
  Italic,
  Code,
  SquareCode,
} from "lucide-react";
import { Plus, WandSparkles, X } from "lucide-react";
import { StackToast } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";
import { openclaw } from "@/lib/openclaw";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { ComposerPlusMenu } from "./ComposerPlusMenu";

function ToolBtn({
  label,
  active,
  onClick,
  children,
  ...rest
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      // Keep the textarea's focus/selection when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-control transition-colors",
        active ? "bg-field text-ink" : "text-ink-mute hover:bg-field hover:text-ink",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Composer({
  placeholder,
  e2e,
  busy,
  onSend,
  onAttach,
  attachNotice,
  className,
}: {
  placeholder: string;
  e2e?: boolean;
  /** Disables send while an async send is in flight (spinner on the button). */
  busy?: boolean;
  onSend?: (text: string) => void;
  /** Real attachment handler (T-13). Absent → honest "not available" notice. */
  onAttach?: (files: FileList) => void;
  /** Notice shown when attaching isn't available on this surface. */
  attachNotice?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend?.(text);
    setValue("");
  };

  /** Insert at the caret (falls back to append), keep focus + caret position. */
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    setValue(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  /**
   * Wrap the selection in markdown markers (or unwrap if already wrapped —
   * toggling). With no selection, inserts the markers and parks the caret
   * between them.
   */
  const wrapSelection = (prefix: string, suffix = prefix) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    let next: string;
    let selStart: number;
    let selEnd: number;
    if (before.endsWith(prefix) && after.startsWith(suffix)) {
      // markers directly around the selection → toggle off
      next = before.slice(0, before.length - prefix.length) + selected + after.slice(suffix.length);
      selStart = start - prefix.length;
      selEnd = selStart + selected.length;
    } else if (
      selected.length >= prefix.length + suffix.length &&
      selected.startsWith(prefix) &&
      selected.endsWith(suffix)
    ) {
      // markers inside the selection → toggle off
      const inner = selected.slice(prefix.length, selected.length - suffix.length);
      next = before + inner + after;
      selStart = start;
      selEnd = start + inner.length;
    } else {
      next = before + prefix + selected + suffix + after;
      selStart = start + prefix.length;
      selEnd = selStart + selected.length;
    }
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const closeEmoji = () => {
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  // "Improve draft" — sends the user's OWN unsent draft to the local model via
  // the openclaw-bridge, pinned to route:"local" (the gateway refuses cloud).
  // Never reads received messages; nothing is persisted. Accept replaces the
  // draft; dismiss leaves it untouched.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const improveDraft = async () => {
    const draft = value.trim();
    if (!draft || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await openclaw.rewriteDraft({ draft, route: "local" });
      setAiSuggestion(res.text || null);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Local model unavailable.");
    } finally {
      setAiBusy(false);
    }
  };

  const acceptSuggestion = () => {
    if (aiSuggestion == null) return;
    setValue(aiSuggestion);
    setAiSuggestion(null);
    textareaRef.current?.focus();
  };

  return (
    <div className={cn("px-4 pb-4 pt-1", className)}>
      <div className="relative rounded-card border border-line bg-paper-2 transition-colors focus-within:border-line-strong focus-within:ring-2 focus-within:ring-[color:var(--st-ring)]">
        {emojiOpen && (
          <EmojiPickerPopover
            className="absolute bottom-full right-0 z-30 mb-2"
            onPick={(emoji) => {
              insertEmoji(emoji);
              closeEmoji();
            }}
            onClose={closeEmoji}
          />
        )}
        {plusOpen && (
          <ComposerPlusMenu
            className="absolute bottom-full left-0 z-30 mb-2"
            onAttach={(files) => {
              if (!files || files.length === 0) return;
              if (onAttach) {
                onAttach(files); // real upload flow (channels — T-13)
              } else {
                // No handler on this surface (e.g. E2E DMs: no SDK attachment
                // API) — honest no-op, never a fake success.
                showNotice(attachNotice ?? "Attachments coming soon — nothing was uploaded.");
              }
            }}
            onClose={() => {
              setPlusOpen(false);
              textareaRef.current?.focus();
            }}
          />
        )}
        {notice && (
          <StackToast
            tone="info"
            message={notice}
            onDismiss={() => setNotice(null)}
            className="absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap"
          />
        )}
        {(aiSuggestion !== null || aiError) && (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-card border border-line bg-paper p-3 font-stack shadow-[var(--st-shadow-card)]">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
              <WandSparkles className="size-3.5" /> Suggested rewrite
              <span className="rounded-full bg-field px-1.5 py-0.5 font-mono text-[9.5px] normal-case text-ink-faint">local model</span>
              <button
                onClick={() => {
                  setAiSuggestion(null);
                  setAiError(null);
                }}
                aria-label="Dismiss suggestion"
                className="ml-auto grid size-6 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {aiError ? (
              <p className="text-[13px] text-negative">{aiError}</p>
            ) : (
              <>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{aiSuggestion}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={acceptSuggestion}
                    className="rounded-control bg-ink px-3 py-1.5 text-[12.5px] font-medium text-paper transition-colors hover:bg-ink-hover"
                  >
                    Use this
                  </button>
                  <button
                    onClick={() => void improveDraft()}
                    disabled={aiBusy}
                    className="rounded-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mute transition-colors hover:bg-field hover:text-ink"
                  >
                    {aiBusy ? "Thinking…" : "Try again"}
                  </button>
                  <span className="ml-auto text-[11px] text-ink-faint">your draft stays untouched until you accept</span>
                </div>
              </>
            )}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
              return;
            }
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
              const k = e.key.toLowerCase();
              if (k === "b") {
                e.preventDefault();
                wrapSelection("**");
              } else if (k === "i") {
                e.preventDefault();
                wrapSelection("*");
              } else if (k === "e") {
                e.preventDefault();
                wrapSelection("`");
              }
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-plus-toggle
              onClick={() => setPlusOpen((o) => !o)}
              aria-label="More options"
              aria-expanded={plusOpen}
              aria-haspopup="menu"
              className={cn(
                "grid size-8 place-items-center rounded-control transition-colors",
                plusOpen ? "bg-field text-ink" : "text-ink-mute hover:bg-field hover:text-ink",
              )}
            >
              <Plus className={cn("size-4 transition-transform", plusOpen && "rotate-45")} />
            </button>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint">
              {e2e ? <ShieldCheck className="size-3.5 text-positive" /> : <Shield className="size-3.5" />}
              {e2e ? "End-to-end encrypted" : "Workspace-confidential"}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <ToolBtn label="Improve draft (local AI)" active={aiBusy} onClick={() => void improveDraft()}>
              <WandSparkles className={cn("size-4", aiBusy && "animate-pulse")} />
            </ToolBtn>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            <ToolBtn label="Bold (Ctrl+B)" onClick={() => wrapSelection("**")}>
              <Bold className="size-4" />
            </ToolBtn>
            <ToolBtn label="Italic (Ctrl+I)" onClick={() => wrapSelection("*")}>
              <Italic className="size-4" />
            </ToolBtn>
            <ToolBtn label="Inline code (Ctrl+E)" onClick={() => wrapSelection("`")}>
              <Code className="size-4" />
            </ToolBtn>
            <ToolBtn label="Code block" onClick={() => wrapSelection("```\n", "\n```")}>
              <SquareCode className="size-4" />
            </ToolBtn>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            <ToolBtn
              label="Add emoji"
              active={emojiOpen}
              onClick={() => (emojiOpen ? closeEmoji() : setEmojiOpen(true))}
              data-emoji-toggle
              aria-expanded={emojiOpen}
            >
              <Smile className="size-4" />
            </ToolBtn>
            <button
              onClick={submit}
              disabled={!value.trim() || busy}
              aria-label="Send"
              className={cn(
                "ml-1 grid size-8 place-items-center rounded-control transition-colors",
                value.trim() && !busy
                  ? "bg-ink text-paper hover:bg-ink-hover"
                  : "bg-field text-ink-faint",
              )}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
