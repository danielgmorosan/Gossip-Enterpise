import { clsx } from "clsx";

/** The Umbry ghost mascot. Renders the dark glyph on a mint field by default. */
export function UmbryMark({
  size = 32,
  className,
  rounded = "rounded-[28%]",
  fieldColor = "var(--accent)",
}: {
  size?: number;
  className?: string;
  rounded?: string;
  fieldColor?: string;
}) {
  return (
    <span
      className={clsx("inline-grid place-items-center", rounded, className)}
      style={{ width: size, height: size, background: fieldColor }}
    >
      <img
        src="/umbry-icon-black.png"
        alt=""
        aria-hidden
        draggable={false}
        style={{ width: size * 0.62, height: size * 0.62, objectFit: "contain" }}
      />
    </span>
  );
}

/** Full lockup: mark + wordmark. */
export function UmbryLogo({
  size = 32,
  showWordmark = true,
  subtitle,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <UmbryMark size={size} className="glow-accent" />
      {showWordmark && (
        <div className="leading-none">
          <div
            className="font-display font-bold tracking-tight text-text"
            style={{ fontSize: size * 0.58 }}
          >
            Umbry
          </div>
          {subtitle && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
