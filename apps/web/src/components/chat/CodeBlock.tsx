import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Tooltip } from "@gossip/ui/stack";
import { cn } from "@/lib/utils";
import { highlightCode } from "@/lib/highlight";

/**
 * Fenced code block for chat + AI surfaces (T2-04): themed container with a
 * language label, async Shiki syntax highlighting, and a one-click Copy of
 * the EXACT raw source.
 *
 * XSS: `code` is rendered as plain text until Shiki resolves; Shiki output is
 * escaped by construction (see lib/highlight.ts), so the injected HTML never
 * contains attacker-controlled markup.
 */
export function CodeBlock({ code, lang, className }: { code: string; lang?: string; className?: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setHtml(null);
    if (lang) {
      highlightCode(code, lang).then(
        (h) => {
          if (alive) setHtml(h);
        },
        () => {
          /* highlighter failed to load — plain rendering stays */
        },
      );
    }
    return () => {
      alive = false;
    };
  }, [code, lang]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  return (
    <div className={cn("code-block group/code my-1 overflow-hidden rounded-control border border-line bg-paper-2 font-stack text-left", className)}>
      <div className="flex h-7 items-center gap-2 border-b border-line bg-field/60 pl-2.5 pr-1">
        <span className="font-mono text-[10px] lowercase tracking-wide text-ink-faint">{lang || "code"}</span>
        <Tooltip label={copied ? "Copied!" : "Copy code"} className="ml-auto">
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copy code"
            className={cn(
              "grid size-6 place-items-center rounded-[calc(var(--radius-control)-2px)] transition-colors",
              copied ? "text-positive" : "text-ink-faint hover:bg-field hover:text-ink",
            )}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        </Tooltip>
      </div>
      {html ? (
        // Shiki-escaped output only — see the XSS note above.
        <div className="code-block-body overflow-x-auto px-2.5 py-2" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="code-block-body overflow-x-auto px-2.5 py-2">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
