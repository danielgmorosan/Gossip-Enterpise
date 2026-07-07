import { useId, type ReactNode } from "react";
import { cn } from "../utils";

const MARK_PATH =
  "M9.5 4.5h25c4.7 0 8.5 3.8 8.5 8.5v16.8c0 4.7-3.8 8.5-8.5 8.5H20.2L10 47.5V38H9.5c-4.7 0-8.5-3.8-8.5-8.5V13c0-4.7 3.8-8.5 8.5-8.5Z";

/** Inline gossip speech-bubble mark — avoids CSS-mask SVG loading issues. */
export function GossipMarkGraphic({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 44 52"
      fill="none"
      aria-hidden
      className={className}
      style={style}
    >
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="17.2" cy="21.2" r="2.9" fill="currentColor" />
      <circle cx="26.8" cy="21.2" r="2.9" fill="currentColor" />
    </svg>
  );
}

/** Staggered tile of gossip marks, faded toward the centre so content stays legible. */
function GossipMarkPattern() {
  const uid = useId().replace(/:/g, "");
  const patternId = `gossip-tile-${uid}`;
  const maskId = `gossip-fade-${uid}`;
  const gradientId = `gossip-fade-grad-${uid}`;

  const mark = (
    <g transform="scale(0.5)">
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="17.2" cy="21.2" r="2.9" fill="currentColor" />
      <circle cx="26.8" cy="21.2" r="2.9" fill="currentColor" />
    </g>
  );

  return (
    <svg
      className="absolute inset-0 h-full w-full text-ink"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id={patternId}
          width="88"
          height="100"
          patternUnits="userSpaceOnUse"
        >
          <g opacity="0.11">{mark}</g>
          <g transform="translate(44, 50)" opacity="0.11">
            {mark}
          </g>
        </pattern>
        <radialGradient id={gradientId} cx="50%" cy="46%" r="58%">
          <stop offset="0%" stopColor="white" stopOpacity="0.15" />
          <stop offset="55%" stopColor="white" stopOpacity="0.9" />
          <stop offset="100%" stopColor="white" stopOpacity="0.35" />
        </radialGradient>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} mask={`url(#${maskId})`} />
    </svg>
  );
}

/**
 * Decorative brand panel for the right half of auth screens: a soft
 * diagonal wash with a subtle gossip-mark tile and room for showcase
 * content (cards, product shots) in the middle.
 */
export function DecorPanel({
  children,
  className,
  align = "center",
}: {
  children?: ReactNode;
  className?: string;
  /** Horizontal placement of `children` in the panel. Defaults to centered. */
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "relative h-full overflow-hidden",
        "bg-[linear-gradient(160deg,var(--st-paper)_0%,var(--st-paper-2)_45%,var(--st-field)_100%)]",
        className,
      )}
    >
      <GossipMarkPattern />
      {children && (
        <div
          className={cn(
            "relative flex h-full p-12",
            align === "start" ? "items-start justify-start" : "items-center justify-center",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** White floating card used inside DecorPanel showcase content. */
export function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-card bg-paper shadow-[var(--st-shadow-card)] border border-line/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Full-width dark bar anchoring the page — brand left, attribution right. */
export function FooterBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <footer className="flex h-16 shrink-0 items-center justify-between bg-inverse px-6 text-inverse-ink">
      <div className="flex items-center gap-2.5 font-semibold">{start}</div>
      <div className="flex items-center gap-2.5 text-sm">{end}</div>
    </footer>
  );
}

/**
 * 50/50 split auth screen: form column on the left (logo top-left,
 * content centered at ~400px, legal note at the bottom), decorative
 * panel on the right, optional dark footer bar. Panel collapses on
 * small screens.
 */
export function AuthLayout({
  brand,
  legal,
  panel,
  footer,
  children,
}: {
  /** Logo lockup rendered top-left. */
  brand?: ReactNode;
  /** Fine print centered under the form ("By signing up, you agree…"). */
  legal?: ReactNode;
  /** Right-half content; defaults to the plain DecorPanel. */
  panel?: ReactNode;
  /** FooterBar (or any full-width footer). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper font-stack text-ink">
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="flex flex-col">
          {brand && (
            <header className="px-6 pt-7">
              <div className="mx-auto w-full max-w-[400px]">{brand}</div>
            </header>
          )}
          <main className="flex flex-1 items-center justify-center px-6 py-10">
            <div className="w-full max-w-[400px]">{children}</div>
          </main>
          {legal && (
            <div className="px-6 pb-8 text-center text-[13px] leading-relaxed text-ink-mute">
              {legal}
            </div>
          )}
        </div>
        <div className="hidden lg:block">{panel ?? <DecorPanel />}</div>
      </div>
      {footer}
    </div>
  );
}
