import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./CodeBlock";

/**
 * Minimal, safe markdown renderer for chat messages.
 * Supports **bold**, *italic*, `inline code`, and ``` fenced code blocks —
 * exactly what the composer toolbar produces. Storage stays plain markdown
 * text (transport-agnostic, E2E-safe; no rich HTML over the wire).
 *
 * Output is built purely from React elements. Raw HTML in the input is never
 * parsed (it renders as literal text) and links are not auto-rendered, so
 * inputs like `<img onerror=…>` or `[x](javascript:…)` are inert. No
 * dangerouslySetInnerHTML anywhere.
 */

/**
 * Inline tokens: @[mention](id) · `code` · **bold** · *italic*
 * (first match wins, left to right).
 */
const INLINE = /(@\[[^\]\n]+\]\(gossip1[a-z0-9]+\))|(`[^`\n]+`)|(\*\*[^\n]+?\*\*)|(\*[^*\s][^*\n]*?\*)/;
const MENTION = /^@\[([^\]]+)\]\((gossip1[a-z0-9]+)\)$/;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    if (m[1]) {
      // Structured mention token (T2-05): highlighted chip carrying the real
      // member id (data attr) so notifications (T2-09) can resolve targets.
      const mm = MENTION.exec(tok)!;
      out.push(
        <span key={k++} data-mention-id={mm[2]} title={mm[2]} className="md-chip rounded px-1 py-px font-medium">
          @{mm[1]}
        </span>,
      );
    } else if (m[2]) {
      out.push(
        <code key={k++} className="md-chip rounded px-1 py-px font-mono text-[0.88em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[3]) {
      out.push(
        <strong key={k++} className="font-semibold">
          {renderInline(tok.slice(2, -2))}
        </strong>,
      );
    } else {
      out.push(<em key={k++}>{renderInline(tok.slice(1, -1))}</em>);
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

/** Complete fenced blocks: ```lang\n…``` (unterminated fences render literally). */
const FENCE = /```([\w-]*)\n?([\s\S]*?)```/g;

export function MessageBody({ text, className }: { text: string; className?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(FENCE)) {
    const idx = m.index ?? 0;
    // Text before the fence (drop the single newline that separates it from the block).
    const before = text.slice(last, idx).replace(/\n$/, "");
    if (before) parts.push(<Fragment key={i++}>{renderInline(before)}</Fragment>);
    const code = m[2].replace(/\n$/, "");
    parts.push(<CodeBlock key={i++} code={code} lang={m[1] || undefined} />);
    last = idx + m[0].length;
    if (text[last] === "\n") last += 1; // swallow the newline right after the block
  }
  const tail = text.slice(last);
  if (tail) parts.push(<Fragment key={i++}>{renderInline(tail)}</Fragment>);
  return <span className={cn("whitespace-pre-wrap", className)}>{parts}</span>;
}
