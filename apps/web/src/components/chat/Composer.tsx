import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
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
  FileText,
} from "lucide-react";
import { Plus, WandSparkles, X } from "lucide-react";
import { StackToast, Tooltip } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";
import { openclaw } from "@/lib/openclaw";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { ComposerPlusMenu } from "./ComposerPlusMenu";
import { MentionPopover, type MentionCandidate } from "./MentionPopover";

/** Active "@query" right before the caret (starts a mention), or null. */
const MENTION_TRIGGER = /(^|\s)@(\S{0,30})$/;

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
    <Tooltip label={label}>
      <button
        type="button"
        // Keep the textarea's focus/selection when clicking toolbar buttons.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        aria-label={label}
        className={cn(
          "grid size-8 place-items-center rounded-control transition-colors",
          active ? "bg-field text-ink" : "text-ink-mute hover:bg-field hover:text-ink",
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** A staged (not yet sent) attachment chip: image thumbnail or file card + remove. */
function StagedFileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const previewUrl = useMemo(
    () => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  return (
    <div className="relative">
      {previewUrl ? (
        <img src={previewUrl} alt={file.name} title={file.name} className="size-16 rounded-control border border-line object-cover" />
      ) : (
        <div className="flex h-16 items-center gap-2 rounded-control border border-line bg-field px-3">
          <FileText className="size-4 shrink-0 text-ink-mute" />
          <span className="max-w-[140px] truncate text-[12px] text-ink">{file.name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-paper transition-colors hover:bg-negative"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export function Composer({
  placeholder,
  e2e,
  busy,
  onSend,
  onAttach,
  attachNotice,
  staged,
  onRemoveStaged,
  replyingTo,
  onCancelReply,
  onTyping,
  mentionCandidates,
  className,
}: {
  placeholder: string;
  e2e?: boolean;
  /** Disables send while an async send is in flight (spinner on the button). */
  busy?: boolean;
  onSend?: (text: string) => void;
  /** Stages files (T3) - nothing uploads or sends until the user hits Send. */
  onAttach?: (files: FileList) => void;
  /** Notice shown when attaching isn't available on this surface. */
  attachNotice?: string;
  /** Files staged by the parent, rendered as removable chips above the input. */
  staged?: File[];
  onRemoveStaged?: (index: number) => void;
  /** Quote-reply target (T3): shows a "Replying to X" bar above the input. */
  replyingTo?: { senderName: string; body: string } | null;
  onCancelReply?: () => void;
  /** Fired (throttled by the caller) while the user is typing (T3). */
  onTyping?: () => void;
  /** Members/contacts offered by the @mention picker (T2-05). Absent → no picker. */
  mentionCandidates?: MentionCandidate[];
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── @mention picker (T2-05) ────────────────────────────────────────
  const listboxId = useId();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null || !mentionCandidates?.length) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, mentionCandidates]);
  const mentionOpen = mentionMatches.length > 0;

  /** Re-derive the active @query from the text before the caret. */
  const syncMention = (text: string) => {
    if (!mentionCandidates?.length) return;
    const caret = textareaRef.current?.selectionStart ?? text.length;
    const m = MENTION_TRIGGER.exec(text.slice(0, caret));
    const q = m ? m[2] : null;
    setMentionQuery(q);
    if (q !== null) setMentionIndex(0);
  };

  /**
   * Replace the trigger "@query" with the plain display name. The draft stays
   * readable (no gossip1… ids); the structured @[Name](id) token is created
   * at SEND time by tokenizeMentions below.
   */
  const insertMention = (c: MentionCandidate) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const m = MENTION_TRIGGER.exec(value.slice(0, caret));
    if (!m) return;
    const start = caret - m[2].length - 1; // position of "@"
    const display = c.name.replace(/[[\]()]/g, "").trim() || c.id.slice(0, 12);
    const inserted = `@${display} `;
    setValue(value.slice(0, start) + inserted + value.slice(caret));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  /** "@Display Name" → "@[Display Name](gossip1…)" for every known member. */
  const tokenizeMentions = (text: string): string => {
    if (!mentionCandidates?.length) return text;
    let out = text;
    // Longest names first so "Dan Smith" wins over "Dan".
    for (const c of [...mentionCandidates].sort((a, b) => b.name.length - a.name.length)) {
      const display = c.name.replace(/[[\]()]/g, "").trim();
      if (!display) continue;
      const esc = display.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`@${esc}(?=$|[\\s.,!?;:])`, "gm"), `@[${display}](${c.id})`);
    }
    return out;
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const hasStaged = !!staged?.length;

  const submit = () => {
    const text = value.trim();
    // Staged attachments can be sent without any text (image-only message).
    if ((!text && !hasStaged) || busy) return;
    onSend?.(tokenizeMentions(text));
    setValue("");
    setMentionQuery(null);
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
   * Wrap the selection in markdown markers (or unwrap if already wrapped -
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

  // "Improve draft" - sends the user's OWN unsent draft to the local model via
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
                onAttach(files); // real upload flow (channels - T-13)
              } else {
                // No handler on this surface (e.g. E2E DMs: no SDK attachment
                // API) - honest no-op, never a fake success.
                showNotice(attachNotice ?? "Attachments are coming soon. Nothing was uploaded.");
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
              <Tooltip label="Dismiss suggestion" className="ml-auto">
                <button
                  onClick={() => {
                    setAiSuggestion(null);
                    setAiError(null);
                  }}
                  aria-label="Dismiss suggestion"
                  className="grid size-6 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </Tooltip>
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
        {mentionOpen && (
          <MentionPopover
            className="absolute bottom-full left-3 z-30 mb-2"
            candidates={mentionMatches}
            activeIndex={mentionIndex}
            listboxId={listboxId}
            onSelect={insertMention}
            onHover={setMentionIndex}
          />
        )}
        {replyingTo && (
          <div className="flex items-center gap-2 border-b border-line px-3.5 py-2 text-[12.5px]">
            <span className="shrink-0 text-ink-faint">Replying to</span>
            <span className="shrink-0 font-semibold text-ink">{replyingTo.senderName}</span>
            <span className="min-w-0 truncate text-ink-mute">{replyingTo.body}</span>
            <button
              onClick={onCancelReply}
              aria-label="Cancel reply"
              className="ml-auto grid size-6 shrink-0 place-items-center rounded-control text-ink-faint hover:bg-field hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {hasStaged && (
          <div className="flex flex-wrap gap-2.5 border-b border-line px-3.5 pb-2.5 pt-3">
            {staged!.map((f, i) => (
              <StagedFileChip key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => onRemoveStaged?.(i)} />
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            syncMention(e.target.value);
            if (e.target.value.trim()) onTyping?.();
          }}
          onSelect={() => syncMention(value)}
          onPaste={(e) => {
            // Ctrl+V with an image/file on the clipboard (screenshots!) stages
            // it like a drop - text pastes keep their normal behavior.
            const files = e.clipboardData?.files;
            if (!files?.length) return;
            e.preventDefault();
            if (onAttach) onAttach(files);
            else showNotice(attachNotice ?? "Attachments are coming soon. Nothing was uploaded.");
          }}
          aria-autocomplete={mentionCandidates?.length ? "list" : undefined}
          aria-expanded={mentionCandidates?.length ? mentionOpen : undefined}
          aria-controls={mentionOpen ? listboxId : undefined}
          aria-activedescendant={mentionOpen ? `${listboxId}-opt-${mentionIndex}` : undefined}
          onKeyDown={(e) => {
            // Mention picker owns the keys while it's open.
            if (mentionOpen) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionMatches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(mentionMatches[mentionIndex]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
            }
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
          placeholder={hasStaged ? "Add a message… (optional)" : placeholder}
          className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-2">
          <div className="flex items-center gap-2">
            <Tooltip label="More options">
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
            </Tooltip>
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
            <Tooltip label="Send (Enter)" className="ml-1">
              <button
                onClick={submit}
                disabled={(!value.trim() && !hasStaged) || busy}
                aria-label="Send"
                className={cn(
                  "grid size-8 place-items-center rounded-control transition-colors",
                  (value.trim() || hasStaged) && !busy
                    ? "bg-ink text-paper hover:bg-ink-hover"
                    : "bg-field text-ink-faint",
                )}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
