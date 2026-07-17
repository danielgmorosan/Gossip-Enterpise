import type { ReactNode } from "react";
import { cn } from "../utils";

const MARK_URL = "url(/umbry-icon-white.png)";

/**
 * The Umbry ghost mark, recolorable via `currentColor`: the white-on-transparent
 * icon is used as an alpha mask over a currentColor fill.
 */
export function UmbryMarkGraphic({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block", className)}
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: MARK_URL,
        maskImage: MARK_URL,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    />
  );
}

/** Tile of brand marks, faded toward the centre so content stays legible. */
function UmbryMarkPattern() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 text-ink"
      style={{
        opacity: 0.11,
        backgroundColor: "currentColor",
        WebkitMaskImage: `${MARK_URL}, radial-gradient(circle at 50% 46%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.9) 55%, rgba(0,0,0,0.35) 100%)`,
        maskImage: `${MARK_URL}, radial-gradient(circle at 50% 46%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.9) 55%, rgba(0,0,0,0.35) 100%)`,
        WebkitMaskRepeat: "repeat, no-repeat",
        maskRepeat: "repeat, no-repeat",
        WebkitMaskSize: "44px 47px, 100% 100%",
        maskSize: "44px 47px, 100% 100%",
        WebkitMaskPosition: "12px 14px, center",
        maskPosition: "12px 14px, center",
        WebkitMaskComposite: "source-in",
        maskComposite: "intersect",
      }}
    />
  );
}

/**
 * Decorative brand panel for the right half of auth screens: a soft
 * diagonal wash with a subtle brand-mark tile and room for showcase
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
      <UmbryMarkPattern />
      {/* Green brand ambience (T3): two soft mint glows drifting off the
          corners - ties the decor panel to the app's positive accent without
          shouting. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--st-positive) 26%, transparent) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 size-[32rem] rounded-full opacity-45 blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--st-positive) 20%, transparent) 0%, transparent 70%)" }}
      />
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
